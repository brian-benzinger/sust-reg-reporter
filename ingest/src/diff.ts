import { diff, type Classifier, type StructuredDiff } from "semdiff";

export type { StructuredDiff, Change, Span } from "semdiff";

/**
 * Run semdiff (ADR-0007) over the before/after text of a changed snapshot,
 * producing a meaning-aware `StructuredDiff` that surfaces substantive changes
 * and suppresses cosmetic ones.
 *
 * semdiff's change spans are half-open character offsets into the LITERAL input,
 * so when `before`/`after` are the immutable content-addressed snapshot text
 * (ADR-0011) the offsets map field-for-field onto a `SourceCitation.span`
 * (ADR-0004) — the diff is itself citable.
 *
 * In production the default Anthropic-backed classifier is used (semdiff reads
 * `ANTHROPIC_API_KEY`, constructing it only when there is a change to classify);
 * tests inject a deterministic `classifier` to stay offline and free.
 */
export async function diffSnapshots(
  before: string,
  after: string,
  classifier?: Classifier,
): Promise<StructuredDiff> {
  return diff(before, after, classifier ? { classifier } : undefined);
}
