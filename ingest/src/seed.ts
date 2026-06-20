/**
 * Bitemporal corpus seeding (ADR-0003, ADR-0009).
 *
 * Persists the regulation/obligation corpus and its status history. An
 * obligation's identity and static attributes are written once
 * (insert-if-absent, mirroring how sources are recorded); its status *over
 * time* lives in `obligation_status_history`, which is strictly append-only — a
 * later recording corrects an earlier belief about a valid period without
 * erasing it (the SB 261 enforcement stay; ADR-0006). Nothing is mutated in
 * place.
 *
 * Re-running is idempotent (ADR-0017): an obligation already present is not
 * rewritten, and status facts are appended only when none have yet been
 * recorded for that obligation, so a retried seed never duplicates the history.
 *
 * Pure orchestration over injected I/O — unit-tested with fakes; the DSQL glue
 * lives in `io/obligations.ts`.
 */
import { resolveSpan } from "@sust-reg/core";
import type {
  GroundingConfidence,
  GroundingMethod,
  Obligation,
  ObligationStatusHistory,
} from "@sust-reg/core";

/** An obligation's static attributes, shaped for persistence. */
export interface ObligationRow {
  readonly id: string;
  readonly regime: string;
  readonly title: string;
  /** JSON-encoded `ApplicabilityCriteria` (DSQL has no `jsonb`; ADR-0012). */
  readonly criteria: string;
  readonly firstReportingDeadline: string | null;
  readonly sourceLabel: string;
  /** Snapshot hash the citation pins to; the seed sentinel until grounded. */
  readonly sourceSnapshotHash: string;
  readonly sourceUrl: string | null;
  readonly retrievedAt: string | null;
}

/** One append-only bitemporal status fact, shaped for persistence. */
export interface StatusFactRow {
  readonly obligationId: string;
  readonly status: string;
  readonly validFrom: string;
  readonly validTo: string | null;
  readonly recordedAt: string;
}

/** One append-only grounding fact, shaped for persistence (ADR-0028). */
export interface GroundingRow {
  readonly obligationId: string;
  readonly sourceKey: string;
  readonly sourceVersionId: string;
  readonly contentHash: string;
  /** Character offsets within the snapshot; null ⇒ document-level grounding. */
  readonly spanStart: number | null;
  readonly spanEnd: number | null;
  readonly retrievedAt: string;
  readonly method: GroundingMethod;
  readonly confidence: GroundingConfidence;
  readonly recordedAt: string;
}

/** A pointer to the latest immutable snapshot recorded for a source. */
export interface SourceVersionRef {
  readonly id: string;
  readonly contentHash: string;
  readonly retrievedAt: string;
}

/** Injected I/O for a corpus seed run. */
export interface SeedDeps {
  obligationExists(id: string): Promise<boolean>;
  insertObligation(row: ObligationRow): Promise<void>;
  /** How many status facts are already recorded for this obligation. */
  statusFactsRecorded(obligationId: string): Promise<number>;
  appendStatusFact(row: StatusFactRow): Promise<void>;
  /** The latest snapshot recorded for a source, if any (ADR-0028). */
  latestSourceVersion(sourceKey: string): Promise<SourceVersionRef | undefined>;
  /**
   * Whether this obligation already has a grounding of this `method` to this
   * exact snapshot. Method-aware so a span grounding can be appended to a
   * snapshot already grounded at document level — the upgrade path (ADR-0035).
   */
  groundingExists(
    obligationId: string,
    contentHash: string,
    method: GroundingMethod,
  ): Promise<boolean>;
  appendGrounding(row: GroundingRow): Promise<void>;
  /** Fetch a snapshot's text by content hash, for span resolution (ADR-0035). */
  readSnapshot(contentHash: string): Promise<string>;
}

/** Outcome of grounding one obligation. */
export interface GroundResult {
  readonly obligationId: string;
  readonly grounded: boolean;
  /** Why grounding did or didn't happen — useful for diagnostics. */
  readonly reason: "grounded" | "no-source" | "no-snapshot" | "already-grounded";
  /** Which grounding granularity applied (span vs document), when determined. */
  readonly method?: GroundingMethod;
  /** Extraction confidence of a span grounding (ADR-0035), when grounded. */
  readonly confidence?: GroundingConfidence;
}

export interface SeedResult {
  readonly obligationId: string;
  readonly obligationInserted: boolean;
  readonly statusFactsAppended: number;
}

/** Project an `Obligation` onto its persistence row. */
export function toObligationRow(o: Obligation): ObligationRow {
  return {
    id: o.id,
    regime: o.regime,
    title: o.title,
    criteria: JSON.stringify(o.criteria),
    firstReportingDeadline: o.firstReportingDeadline ?? null,
    sourceLabel: o.source.label,
    sourceSnapshotHash: o.source.snapshotHash,
    sourceUrl: o.source.sourceUrl ?? null,
    retrievedAt: o.source.retrievedAt ?? null,
  };
}

/** Project a status history onto its append-only fact rows, in record order. */
export function toStatusFactRows(h: ObligationStatusHistory): StatusFactRow[] {
  return h.history.map((f) => ({
    obligationId: h.obligationId,
    status: f.value,
    validFrom: f.validFrom,
    validTo: f.validTo ?? null,
    recordedAt: f.recordedAt,
  }));
}

/**
 * Seed one obligation and (if provided) its status history. Insert-if-absent
 * for the obligation; append-the-whole-history only when none is recorded yet.
 */
export async function seedObligation(
  deps: SeedDeps,
  obligation: Obligation,
  history: ObligationStatusHistory | undefined,
): Promise<SeedResult> {
  let obligationInserted = false;
  if (!(await deps.obligationExists(obligation.id))) {
    await deps.insertObligation(toObligationRow(obligation));
    obligationInserted = true;
  }

  let statusFactsAppended = 0;
  if (history !== undefined && (await deps.statusFactsRecorded(obligation.id)) === 0) {
    for (const row of toStatusFactRows(history)) {
      await deps.appendStatusFact(row);
      statusFactsAppended += 1;
    }
  }

  return { obligationId: obligation.id, obligationInserted, statusFactsAppended };
}

/**
 * Seed a set of obligations with their status histories (matched by
 * obligation id). Deterministic and idempotent (ADR-0017).
 */
export async function seedCorpus(
  deps: SeedDeps,
  obligations: readonly Obligation[],
  histories: readonly ObligationStatusHistory[],
): Promise<SeedResult[]> {
  const byId = new Map(histories.map((h) => [h.obligationId, h]));
  const out: SeedResult[] = [];
  for (const o of obligations) {
    out.push(await seedObligation(deps, o, byId.get(o.id)));
  }
  return out;
}

/**
 * Ground one obligation to its source's latest snapshot, idempotently
 * (ADR-0028 §5, ADR-0035). Appends a grounding only when the obligation declares
 * a `sourceKey`, that source has an ingested snapshot, and that exact snapshot
 * is not already grounded at the chosen granularity — so re-runs and unchanged
 * sources never duplicate a grounding (the same "append only when absent"
 * discipline as the seed; ADR-0017). An obligation with no registered source
 * stays ungrounded.
 *
 * When the obligation carries a `locator` that resolves against the snapshot
 * text, a precise **span** grounding is appended (ADR-0035); otherwise — no
 * locator, or it does not resolve — grounding stays **document**-level. The two
 * are tracked separately, so an already-document-grounded snapshot is upgraded
 * to span the first time its locator resolves (the backfill path), and the
 * later span fact supersedes the document one on read.
 */
export async function groundObligation(
  deps: SeedDeps,
  obligation: Obligation,
  recordedAt: string,
): Promise<GroundResult> {
  const sourceKey = obligation.sourceKey;
  if (sourceKey === undefined) {
    return { obligationId: obligation.id, grounded: false, reason: "no-source" };
  }
  const version = await deps.latestSourceVersion(sourceKey);
  if (version === undefined) {
    return { obligationId: obligation.id, grounded: false, reason: "no-snapshot" };
  }

  const base = {
    obligationId: obligation.id,
    sourceKey,
    sourceVersionId: version.id,
    contentHash: version.contentHash,
    retrievedAt: version.retrievedAt,
    recordedAt,
  };

  // Prefer a span grounding when the obligation has a locator. Check for an
  // existing span grounding first so an unchanged snapshot skips the S3 fetch.
  const locator = obligation.locator;
  if (locator !== undefined) {
    if (await deps.groundingExists(obligation.id, version.contentHash, "span")) {
      return {
        obligationId: obligation.id,
        grounded: false,
        reason: "already-grounded",
        method: "span",
      };
    }
    const span = resolveSpan(locator, await deps.readSnapshot(version.contentHash));
    if (span !== undefined) {
      await deps.appendGrounding({
        ...base,
        spanStart: span.start,
        spanEnd: span.end,
        method: "span",
        confidence: span.confidence,
      });
      return {
        obligationId: obligation.id,
        grounded: true,
        reason: "grounded",
        method: "span",
        confidence: span.confidence,
      };
    }
    // Locator did not resolve against this snapshot — fall back to document
    // level rather than asserting an unverified span (ADR-0035).
  }

  if (await deps.groundingExists(obligation.id, version.contentHash, "document")) {
    return {
      obligationId: obligation.id,
      grounded: false,
      reason: "already-grounded",
      method: "document",
    };
  }
  await deps.appendGrounding({
    ...base,
    spanStart: null,
    spanEnd: null,
    method: "document",
    confidence: "high",
  });
  return {
    obligationId: obligation.id,
    grounded: true,
    reason: "grounded",
    method: "document",
    confidence: "high",
  };
}

/**
 * Ground a set of obligations to their sources' latest snapshots (ADR-0028).
 * Idempotent: safe to run after every seed and every ingest pass — it appends a
 * grounding only when a source has a snapshot not yet grounded to. `recordedAt`
 * is the transaction time stamped on any new grounding (the caller's clock).
 */
export async function groundCorpus(
  deps: SeedDeps,
  obligations: readonly Obligation[],
  recordedAt: string,
): Promise<GroundResult[]> {
  const out: GroundResult[] = [];
  for (const o of obligations) {
    out.push(await groundObligation(deps, o, recordedAt));
  }
  return out;
}
