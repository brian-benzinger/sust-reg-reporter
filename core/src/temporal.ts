/**
 * Bitemporal resolution primitives (ADR-0003).
 *
 * The data model preserves two independent time axes and never mutates a record
 * in place:
 *
 *  - **valid time** — when a fact was actually true in the world (e.g. when a
 *    rule was in force);
 *  - **transaction time** — when we *recorded* that fact (when we learned it).
 *
 * A later recording can correct what we believed about a past valid period
 * without destroying the earlier belief. That is the whole point of the model
 * and the basis of the as-of-date slider: it can answer both "what was in
 * effect on date D" and "what did we believe was in effect on D, as of our
 * knowledge on date K".
 *
 * Pure and dependency-free, like the rest of `core`. Dates are ISO-8601
 * `YYYY-MM-DD` strings, compared lexicographically (which is also chronological
 * for that format).
 */

/** ISO-8601 calendar date, `YYYY-MM-DD`. Compared as a string. */
export type IsoDate = string;

/**
 * A single recorded fact: a `value` asserted to hold over a valid-time interval
 * `[validFrom, validTo)`, as recorded at transaction time `recordedAt`.
 */
export interface TemporalFact<T> {
  readonly value: T;
  /** Valid-time start, inclusive. */
  readonly validFrom: IsoDate;
  /** Valid-time end, exclusive. Omitted means open-ended (still in force). */
  readonly validTo?: IsoDate;
  /** Transaction time: the date we recorded this fact. */
  readonly recordedAt: IsoDate;
}

/** A bitemporal query: a valid-time date viewed as of a transaction-time date. */
export interface AsOf {
  /** Valid-time date — "what was actually true on this date". */
  readonly validOn: IsoDate;
  /** Transaction-time date — "...as we knew it on this date". */
  readonly knownAsOf: IsoDate;
}

/**
 * Resolve the fact in force for a bitemporal query. Among facts that were
 * already recorded (`recordedAt <= knownAsOf`) and whose valid interval contains
 * `validOn`, the one recorded most recently wins — so a later correction
 * supersedes an earlier belief about the same valid period. Returns `undefined`
 * when nothing was both known and valid at that point.
 *
 * On a tie in `recordedAt`, the earlier fact in the list is kept, so the result
 * is deterministic for a given ordering.
 */
export function resolveAsOf<T>(
  facts: readonly TemporalFact<T>[],
  asOf: AsOf,
): TemporalFact<T> | undefined {
  let best: TemporalFact<T> | undefined;
  for (const fact of facts) {
    if (fact.recordedAt > asOf.knownAsOf) continue;
    if (asOf.validOn < fact.validFrom) continue;
    if (fact.validTo !== undefined && asOf.validOn >= fact.validTo) continue;
    if (best === undefined || fact.recordedAt > best.recordedAt) {
      best = fact;
    }
  }
  return best;
}

/** Convenience: the resolved value (not the fact) for a bitemporal query. */
export function resolveValueAsOf<T>(
  facts: readonly TemporalFact<T>[],
  asOf: AsOf,
): T | undefined {
  return resolveAsOf(facts, asOf)?.value;
}

/** The most recent transaction-time date across the facts, if any. */
export function latestRecordedAt<T>(
  facts: readonly TemporalFact<T>[],
): IsoDate | undefined {
  let latest: IsoDate | undefined;
  for (const fact of facts) {
    if (latest === undefined || fact.recordedAt > latest) {
      latest = fact.recordedAt;
    }
  }
  return latest;
}
