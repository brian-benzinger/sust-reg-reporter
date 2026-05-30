# 0012 — Aurora DSQL as the primary data store

- **Status:** Accepted
- **Date:** 2026-05-30

## Context

The queryable corpus must support two core access patterns:

1. **Point-in-time bitemporal lookup** ([ADR-0003](0003-bitemporal-data-model.md)).
2. **Conditional applicability** ([ADR-0005](0005-applicability-engine.md)),
   which reads naturally as a SQL `WHERE` clause over thresholds.

Both are relational by nature. Data volume is tiny (dozens to low hundreds of
regulations, thousands of items), so performance is a non-issue for any
candidate — the decision is driven by which model expresses the logic cleanly
and is most defensible in a design review, and by indefinite free-tier fit
([ADR-0016](0016-aws-always-free-cost-discipline.md)).

## Decision

Use **Aurora DSQL**: PostgreSQL-compatible, AWS-native, serverless, scales to
zero, with an ongoing **Always-Free** tier (100,000 DPUs and 1 GiB storage per
month, no expiration).

To avoid Lambda connection-pool exhaustion under burst, access it with a
**stateless HTTP/data-API driver**, not raw TCP pooling
([ADR-0010](0010-serverless-snapshotting-pipeline.md)).

## Consequences

- Applicability logic stays as clean SQL predicates rather than being pushed
  into application code.
- Serverless + scale-to-zero + ongoing free tier matches the
  indefinite-lifetime, cost-disciplined goal.

### Caveats to verify before relying on them

- DSQL is PostgreSQL-**compatible**, not full Postgres; extension support is
  limited. **Verify pgvector** before assuming semantic citation search is
  available.
- The `tstzrange` + GiST exclusion-constraint pattern for enforcing
  non-overlapping valid periods **may not be supported**. If not, enforce that
  integrity in **application code** ([ADR-0003](0003-bitemporal-data-model.md)).
- There are **restrictions on certain `ALTER` operations** on large tables;
  plan migrations accordingly.

## Alternatives considered (fallbacks)

- **Neon** — full Postgres, free tier, HTTP driver that avoids Lambda
  connection-pool exhaustion. The fallback if DSQL's feature gaps (range types,
  exclusion constraints, FKs, pgvector) prove disqualifying.
- **DynamoDB** — Always-Free and generous, but **fights the relational access
  patterns** and pushes applicability logic into the application layer.
  Rejected as primary for that reason.
- **Raw Postgres on Lambda with TCP pooling.** Rejected: connection exhaustion
  under burst unless fronted by a stateless HTTP driver.
