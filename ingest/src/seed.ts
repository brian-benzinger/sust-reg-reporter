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
import type { Obligation, ObligationStatusHistory } from "@sust-reg/core";

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

/** Injected I/O for a corpus seed run. */
export interface SeedDeps {
  obligationExists(id: string): Promise<boolean>;
  insertObligation(row: ObligationRow): Promise<void>;
  /** How many status facts are already recorded for this obligation. */
  statusFactsRecorded(obligationId: string): Promise<number>;
  appendStatusFact(row: StatusFactRow): Promise<void>;
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
