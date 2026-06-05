/**
 * Client-side grounding overlay (ADR-0028).
 *
 * The static Regimes and obligation pages prerender each obligation's *seed*
 * citation, which is deliberately ungrounded. After hydration they fetch the
 * live grounding from `/api/grounding` and overlay it, so a badge built from
 * ungrounded seed data upgrades to "Grounded" wherever the corpus actually
 * pins the obligation to a stored snapshot — the same source of truth the
 * as-of slider reads. Pure and DOM-free; the islands are thin shells over this.
 */
import type { GroundingApiRow } from "./api.ts";

/** Current grounding keyed by obligation id. */
export type GroundingIndex = ReadonlyMap<string, GroundingApiRow>;

/**
 * Index the API rows by obligation id, keeping only genuinely grounded entries
 * so a stray `grounded: false` row can never mask seed state.
 */
export function indexGroundings(
  rows: readonly GroundingApiRow[],
): GroundingIndex {
  return new Map(rows.filter((r) => r.grounded).map((r) => [r.obligationId, r]));
}
