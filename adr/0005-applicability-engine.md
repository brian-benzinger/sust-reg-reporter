# 0005 — Applicability engine for per-company obligations

- **Status:** Accepted
- **Date:** 2026-05-30

## Context

Knowing what a regulation says is only half the value. Companies need to know
*which obligations apply to them and by when*. That depends on a profile:
revenue, jurisdictions of operation, listing status, and fiscal year end. This
is conditional logic over thresholds, not a static lookup — and it is the
highest-value and hardest piece of the system.

## Decision

Build an **applicability engine** that takes a company profile (revenue,
jurisdictions of operation, listing status, fiscal year end) and determines
which obligations apply and by when, across the covered regimes.

This is modeled as relational, threshold-driven conditional logic — naturally
expressed as SQL `WHERE` clauses over the corpus — which is a primary reason
the data store is relational ([ADR-0012](0012-aurora-dsql-data-store.md)).

## Consequences

- Applicability is reported as structured, threshold-derived fact, not advice,
  staying inside the non-interpretive scope
  ([ADR-0002](0002-primary-source-non-interpretive-scope.md)). Each result
  cites the threshold and source span that triggered it
  ([ADR-0004](0004-citation-integrity.md)).
- The engine must respect both the bitemporal axes (what applied *as of* a date)
  and the explicit status states (a stayed obligation applies-but-unenforced;
  see [ADR-0006](0006-explicit-regulation-status-states.md)).
- It is surfaced to users as the **scope checker** interactive feature
  ([ADR-0013](0013-static-generation-thin-api.md)) — the applicability engine
  made visible.
- This is the deepest domain logic; it warrants the most test coverage and the
  clearest provenance.

## Alternatives considered

- **Static "who's covered" tables.** Rejected: cannot express conditional,
  multi-factor, time-dependent thresholds cleanly; would go stale and mislead.
- **Pushing applicability into a key-value/NoSQL layer.** Rejected: the logic
  reads naturally as relational predicates; a KV store forces it into
  application code and loses queryability (see
  [ADR-0012](0012-aurora-dsql-data-store.md)).
