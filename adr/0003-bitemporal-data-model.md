# 0003 — Bitemporal data model (valid time + transaction time)

- **Status:** Accepted
- **Date:** 2026-05-30

## Context

The differentiating feature of the product is tracking how regulations change
over time, not snapshotting them once. Two distinct temporal questions must be
answerable:

1. *What was actually in effect on date D?* — about the world.
2. *What did we believe was in effect, as of our ingestion on date D?* — about
   our records.

These diverge constantly: a regulation may be amended retroactively, a stay may
be lifted with a backdated effective date, or we may simply ingest a change
days after it occurred. Conflating the two makes audit impossible.

## Decision

Adopt a **bitemporal data model** with two independent time axes:

- **Valid time** — when a rule was actually in effect in the world.
- **Transaction time** — when we recorded (ingested/believed) it.

Every regulatory fact is stored with both intervals, enabling point-in-time
reconstruction along either axis.

## Consequences

- We can answer both "what was in effect on D" and "what did we believe on D,"
  which is exactly what an audit trail in a legal domain requires.
- The as-of-date slider in the web app is the bitemporal model made visible and
  is a primary interactive feature, not decoration
  ([ADR-0013](0013-static-generation-thin-api.md)).
- Non-overlapping valid periods per regulation must be enforced. The preferred
  Postgres approach (`tstzrange` + GiST exclusion constraint) may not be
  supported on the chosen store; if not, this integrity is enforced in
  application code (see [ADR-0012](0012-aurora-dsql-data-store.md)).
- Writes are append/version-oriented; records are not mutated in place, which
  aligns with the immutable snapshot store
  ([ADR-0011](0011-content-addressed-snapshot-store.md)).

## Alternatives considered

- **Single-axis (valid-time only) versioning.** Rejected: cannot reconstruct
  what we believed at ingestion time, defeating auditability.
- **Mutable "current state" rows with a separate history log.** Rejected:
  history-as-afterthought is exactly the design that "gets it catastrophically
  wrong"; bitemporality must be first-class.
