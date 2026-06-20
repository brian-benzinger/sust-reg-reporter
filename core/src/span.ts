/**
 * Span-level grounding locators (ADR-0035, refining ADR-0028 §4).
 *
 * A grounding pins an obligation to an immutable snapshot (ADR-0028); a *span*
 * additionally locates the exact character range within that snapshot. We locate
 * it with a deterministic **text-quote anchor** — a verbatim quote, with
 * optional surrounding context to disambiguate repeats — resolved by exact
 * string search against the snapshot text. No LLM, no schema change, and a span
 * is only ever produced when it is verified to exist in the very snapshot it
 * pins to (ADR-0004, ADR-0016, ADR-0017).
 *
 * Pure and dependency-free, like the rest of `core`.
 */
import type { GroundingConfidence } from "./grounding.ts";

/**
 * A text-quote anchor locating an obligation's passage within a snapshot, after
 * the manner of a W3C `TextQuoteSelector`. `quote` is matched verbatim; the
 * optional `prefix`/`suffix` are the text expected immediately before/after it,
 * used to pick the right occurrence when the quote repeats.
 */
export interface TextQuoteLocator {
  readonly quote: string;
  readonly prefix?: string;
  readonly suffix?: string;
}

/** A resolved character range plus how confident the match is (ADR-0035). */
export interface ResolvedSpan {
  readonly start: number;
  /** Exclusive end offset (`start + quote.length`). */
  readonly end: number;
  readonly confidence: GroundingConfidence;
}

/**
 * Resolve a text-quote locator against snapshot text to exact character offsets
 * and an extraction confidence (ADR-0035). Returns `undefined` when the quote is
 * absent — the caller then keeps document-level grounding (ADR-0028 §5) rather
 * than asserting an unverified span.
 *
 * Confidence degrades honestly:
 *  - `high`   — the quote is unique, or context narrows repeats to exactly one;
 *  - `medium` — the quote repeats and context leaves more than one candidate
 *               (the first is taken);
 *  - `low`    — context was given but matches no occurrence (stale/wrong), so
 *               the first raw occurrence is taken.
 */
export function resolveSpan(
  locator: TextQuoteLocator,
  snapshotText: string,
): ResolvedSpan | undefined {
  const { quote, prefix, suffix } = locator;
  if (quote === "") return undefined;

  const firstAt = snapshotText.indexOf(quote);
  if (firstAt === -1) return undefined;

  const span = (
    start: number,
    confidence: GroundingConfidence,
  ): ResolvedSpan => ({ start, end: start + quote.length, confidence });

  if (prefix === undefined && suffix === undefined) {
    const unique = snapshotText.indexOf(quote, firstAt + 1) === -1;
    return span(firstAt, unique ? "high" : "medium");
  }

  // Context given: scan every occurrence and keep those whose surrounding text
  // matches the prefix/suffix.
  const matchesContext = (at: number): boolean => {
    if (prefix !== undefined && !snapshotText.slice(0, at).endsWith(prefix)) {
      return false;
    }
    if (
      suffix !== undefined &&
      !snapshotText.slice(at + quote.length).startsWith(suffix)
    ) {
      return false;
    }
    return true;
  };

  let firstMatch = -1;
  let matchCount = 0;
  for (let at = firstAt; at !== -1; at = snapshotText.indexOf(quote, at + 1)) {
    if (!matchesContext(at)) continue;
    if (firstMatch === -1) firstMatch = at;
    matchCount += 1;
  }

  if (matchCount === 1) return span(firstMatch, "high");
  if (matchCount > 1) return span(firstMatch, "medium");
  // Context matched nothing — stale/incorrect; fall back to the first raw
  // occurrence at low confidence rather than dropping the span entirely.
  return span(firstAt, "low");
}
