import {
  diff,
  needsReviewVerdict,
  type Classifier,
  type ClassifierVerdict,
  type StructuredDiff,
} from "semdiff";

export type { StructuredDiff, Change, Span } from "semdiff";

/**
 * The most changed units we will pay an LLM to classify in a single diff
 * (ADR-0016). semdiff makes one provider call per changed pair, so a
 * whole-document replacement — e.g. a snapshot captured from a failed fetch, or
 * the first version of a newly tracked source diffed against an empty predecessor
 * — would make hundreds-to-thousands of calls. A genuine amendment is tens of
 * changes (the CSRD Omnibus diff is ~58); beyond this cap a diff is almost
 * certainly structural, so we flag every change for human review instead of
 * classifying it. This both bounds LLM spend per diff and keeps a cap-sized diff
 * well inside the differ's Lambda timeout (semdiff >=0.1.2 classifies the pool
 * concurrently, so ~100 changes is tens of seconds, not minutes).
 */
export const MAX_CLASSIFIED_CHANGES = 100;

/**
 * A no-cost classifier that abstains on every pair using semdiff's canonical
 * needs-review verdict — it makes no provider calls. Used to compute the
 * structural diff (segmentation + alignment) so we can SIZE the change set
 * before deciding whether classifying it is affordable.
 */
const FLAG_FOR_REVIEW: Classifier = {
  classify: (): Promise<ClassifierVerdict> => Promise.resolve(needsReviewVerdict()),
};

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
  maxChanges: number = MAX_CLASSIFIED_CHANGES,
): Promise<StructuredDiff> {
  if (classifier === undefined) {
    return diff(before, after);
  }
  // Size the change set first with a no-cost structural pass (ADR-0016). Above
  // the cap the diff is almost certainly a whole-document replacement, not an
  // amendment; we keep that flagged structural result rather than making one
  // (paid) provider call per change.
  const structural = await diff(before, after, { classifier: FLAG_FOR_REVIEW });
  if (structural.changes.length > maxChanges) {
    return structural;
  }
  return diff(before, after, { classifier });
}
