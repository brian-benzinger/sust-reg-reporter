/**
 * Citation integrity primitives (ADR-0004).
 *
 * Every regulatory fact this system asserts must pin to an exact source span,
 * a specific version of the source, and the date we retrieved it. This type is
 * the in-memory shape of that pin. It does not fetch or validate anything on
 * its own — it is the contract that the rest of the domain carries around so
 * that no obligation, threshold, or status can exist without provenance.
 *
 * Until the ingestion pipeline exists, seed data carries citations whose
 * `snapshotHash` is a placeholder. The shape is deliberately in place now so
 * that "ungrounded" data is visibly distinguishable from grounded data later.
 */
export interface SourceCitation {
  /** Human-readable label, e.g. "California SB 261 (2023), § 38533(b)". */
  readonly label: string;

  /**
   * Content hash of the immutable snapshot the span was drawn from
   * (ADR-0011). A placeholder marks data that is not yet grounded in a real
   * stored snapshot.
   */
  readonly snapshotHash: string;

  /** Canonical URL of the authoritative source (ADR-0008). */
  readonly sourceUrl?: string;

  /** Character offsets of the exact span within the snapshot, if known. */
  readonly span?: { readonly start: number; readonly end: number };

  /** ISO-8601 date we retrieved the snapshot this citation pins to. */
  readonly retrievedAt?: string;
}

/** Sentinel hash for seed/illustrative data not yet backed by a real snapshot. */
export const UNGROUNDED_SNAPSHOT_HASH = "ungrounded:seed";

/**
 * A citation is grounded only if it points at a real stored snapshot, not the
 * seed sentinel. The reliability layer (ADR-0017) uses this to refuse to serve
 * ungrounded data as fact.
 */
export function isGrounded(citation: SourceCitation): boolean {
  return citation.snapshotHash !== UNGROUNDED_SNAPSHOT_HASH;
}
