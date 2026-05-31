# 0022 — In-code bitemporal representation and as-of resolution

- **Status:** Accepted (realizes [ADR-0003](0003-bitemporal-data-model.md))
- **Date:** 2026-05-31

## Context

[ADR-0003](0003-bitemporal-data-model.md) made the bitemporal data model a
non-negotiable invariant: preserve both **valid time** (when a fact was true in
the world) and **transaction time** (when we recorded it), and never mutate or
destroy a prior version. That ADR decided *that* we are bitemporal; it did not
pin the concrete in-code shape.

The as-of-date slider — one of the three interactive features in
[ADR-0013](0013-static-generation-thin-api.md) — needs that shape to exist in
`core` so it can resolve a status for a (valid date, knowledge date) pair. The
representation chosen here will also inform the eventual Aurora DSQL schema
(ADR-0012) and the ingestion pipeline, so it is worth recording even though it
is an implementation of an existing decision rather than a new one.

## Decision

Represent history as a list of immutable **temporal facts** in `core`
(`temporal.ts`), and resolve queries with a pure function:

- A `TemporalFact<T>` carries a `value`, a valid-time interval `[validFrom,
  validTo)` (with `validTo` omitted meaning open-ended), and a `recordedAt`
  transaction-time date. Dates are ISO-8601 `YYYY-MM-DD` strings, compared
  lexicographically (chronological for that format).
- `resolveAsOf(facts, { validOn, knownAsOf })` returns the fact in force:
  among facts already recorded (`recordedAt <= knownAsOf`) whose valid interval
  contains `validOn`, the one with the **latest `recordedAt` wins**, so a later
  correction supersedes an earlier belief about the same valid period. It
  returns `undefined` when nothing was both known and valid. Ties on
  `recordedAt` keep list order, for determinism.
- Facts are append-only: a correction is a **new** fact with a later
  `recordedAt`, never an edit — satisfying ADR-0003's "never mutate in place".

The function is pure and dependency-free, consistent with the rest of `core`
(ADR-0018), so it runs unchanged in the ingestion Lambdas, a future API, and the
browser.

Following the precedent set by [ADR-0021](0021-react-typescript-webpack-web-app.md)
for the scope checker, the **slider resolves client-side**: the computation is
pure and cheap, so it runs in the browser over seed histories rather than
behind the thin API. The API remains the right home for resolution over the
full DSQL-backed corpus once that exists.

## Consequences

- The bitemporal invariant is realized in tested code, with the SB 261
  enforcement-stay modeled as a later-recorded correction — the canonical case
  where valid time and transaction time disagree (ADR-0006).
- The shape (interval + `recordedAt`, last-write-wins) maps cleanly onto a
  relational table later, keeping the DSQL schema honest to ADR-0003.
- String date comparison is correct only for zero-padded `YYYY-MM-DD`; if
  finer-grained timestamps or time zones are ever needed, the comparison must
  move to a real date type. Called out so it is not assumed away.
- Seed histories are illustrative and ungrounded (ADR-0004); they exercise the
  model but must be replaced with ingested, grounded facts before being served
  as truth.

## Alternatives considered

- **Store only the current status (uni-temporal).** Rejected: violates ADR-0003
  and makes the slider — the whole point — impossible.
- **Valid time only, no transaction time.** Rejected: it could answer "what was
  in effect on D" but not "what did we believe on D", losing the correction
  story that distinguishes this product.
- **Mutate a record in place on correction.** Rejected outright by ADR-0003;
  destroys the audit trail the product is built to preserve.
