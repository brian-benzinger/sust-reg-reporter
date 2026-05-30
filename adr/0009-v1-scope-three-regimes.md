# 0009 — v1 scope: three high-churn regimes only

- **Status:** Accepted
- **Date:** 2026-05-30

## Context

Global coverage of climate-disclosure regulation is enormous and would drown a
solo developer before the core architecture is proven. The goal of v1 is to
validate the bitemporal model, the diff engine, and the applicability logic —
not to achieve breadth.

## Decision

Cover exactly **three high-churn, well-documented regimes** in v1, and no more:

- **California SB 253 and SB 261**
- **EU CSRD** (post-Omnibus)
- **ISSB S1 and S2**

## Consequences

- These regimes are high-churn (frequent amendments, stays, guidance), which
  exercises change detection ([ADR-0007](0007-change-detection-via-semdiff.md))
  and the explicit status states
  ([ADR-0006](0006-explicit-regulation-status-states.md)) — including the SB 261
  stayed-enforcement case.
- They are well-documented and served by authoritative sources
  ([ADR-0008](0008-authoritative-source-ingestion.md)), de-risking ingestion.
- They span multiple jurisdictions and listing/revenue thresholds, giving the
  applicability engine ([ADR-0005](0005-applicability-engine.md)) a real, varied
  workout.
- The data volume stays tiny (dozens to low hundreds of regulations, thousands
  of items), so store performance is a non-issue
  ([ADR-0012](0012-aurora-dsql-data-store.md)).

## Alternatives considered

- **Broad/global coverage from the start.** Rejected: drowns the project before
  the architecture is proven; breadth without a working core is worthless.
- **A single regime.** Rejected: too narrow to exercise cross-jurisdiction
  applicability logic, which is the hardest and highest-value piece.
