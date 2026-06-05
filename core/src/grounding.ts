/**
 * Obligation grounding (ADR-0028).
 *
 * Invariant #2 (ADR-0004) requires every regulatory claim to be pinned to a
 * stored source span, a specific snapshot version, and the date we retrieved
 * it. Grounding is the *link* from an obligation to the immutable snapshot that
 * substantiates it — and, like status (ADR-0003), it changes over time: an
 * obligation re-grounds to a newer snapshot whenever its source changes.
 *
 * So grounding is recorded as append-only facts, never a mutable field. Each
 * fact pins an obligation to one `source_version`; the *current* grounding is
 * the latest fact recorded at or before a knowledge date (later re-groundings
 * supersede earlier ones), mirroring `resolveAsOf` on the transaction-time axis.
 * Document-level first; character spans are deferred but the shape is span-ready
 * (ADR-0028 §4).
 *
 * Pure and dependency-free, like the rest of `core`. Dates are ISO-8601 strings
 * compared lexicographically (ADR-0022).
 */
import type { SourceCitation } from "./citation.ts";
import type { IsoDate } from "./temporal.ts";

/**
 * Granularity of a grounding. `document` pins the obligation to the whole
 * snapshot (we know which document substantiates it, not the exact offsets);
 * `span` additionally locates the exact character range (ADR-0028 §4).
 */
export type GroundingMethod = "document" | "span";

/** How sure we are of the grounding claim (ADR-0017). */
export type GroundingConfidence = "high" | "medium" | "low";

/**
 * One append-only fact that an obligation is substantiated by a specific
 * immutable snapshot (ADR-0011, ADR-0028). Single-axis on transaction time: a
 * grounding is *established* at `recordedAt`; re-grounding appends a new fact.
 */
export interface GroundingFact {
  /** The registry source key this grounds to (`ingest` `sources.ts`). */
  readonly sourceKey: string;
  /** The immutable `source_version` the obligation pins to. */
  readonly sourceVersionId: string;
  /** Content hash of that snapshot — also its S3 key (ADR-0011). */
  readonly snapshotHash: string;
  /** ISO-8601 date the snapshot was retrieved — the provenance anchor. */
  readonly retrievedAt: IsoDate;
  /** Character span within the snapshot; absent ⇒ document-level grounding. */
  readonly span?: { readonly start: number; readonly end: number };
  readonly method: GroundingMethod;
  readonly confidence: GroundingConfidence;
  /** Transaction time: when we established this grounding. */
  readonly recordedAt: IsoDate;
}

/** An obligation's append-only grounding history (sibling to status history). */
export interface ObligationGroundingHistory {
  readonly obligationId: string;
  readonly facts: readonly GroundingFact[];
}

/**
 * The current grounding for an obligation as of a knowledge date: the most
 * recently recorded fact at or before `knownAsOf` (a later re-grounding wins).
 * Omitting `knownAsOf` resolves the latest grounding overall. Returns
 * `undefined` when the obligation has no grounding known at that point — i.e.
 * it is still ungrounded.
 *
 * On a tie in `recordedAt`, the earlier fact in the list is kept, so the result
 * is deterministic for a given ordering — matching `resolveAsOf`.
 */
export function latestGrounding(
  facts: readonly GroundingFact[],
  knownAsOf?: IsoDate,
): GroundingFact | undefined {
  let best: GroundingFact | undefined;
  for (const fact of facts) {
    if (knownAsOf !== undefined && fact.recordedAt > knownAsOf) continue;
    if (best === undefined || fact.recordedAt > best.recordedAt) {
      best = fact;
    }
  }
  return best;
}

/**
 * Derive the served `SourceCitation` from an obligation's seed citation and its
 * current grounding fact. With a grounding, the citation pins to the real
 * snapshot (hash + retrieval date + span, keeping the seed's human label/URL);
 * without one, the seed citation is returned unchanged — so it stays ungrounded
 * and the reliability layer flags it (invariant #2, `isGrounded`).
 */
export function groundedCitation(
  seed: SourceCitation,
  grounding: GroundingFact | undefined,
): SourceCitation {
  if (grounding === undefined) return seed;
  return {
    label: seed.label,
    snapshotHash: grounding.snapshotHash,
    ...(seed.sourceUrl !== undefined ? { sourceUrl: seed.sourceUrl } : {}),
    ...(grounding.span !== undefined ? { span: grounding.span } : {}),
    retrievedAt: grounding.retrievedAt,
  };
}
