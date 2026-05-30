# 0018 — Shared `core` workspace for cross-cutting domain logic

- **Status:** Accepted
- **Date:** 2026-05-30

## Context

The repository layout ([ADR-0001](0001-two-repo-structure.md)) names four
workspaces: `ingest`, `api`, `web`, and `infra`. But several pieces of pure
domain logic are cross-cutting:

- the **explicit regulation status states**
  ([ADR-0006](0006-explicit-regulation-status-states.md)),
- the **applicability engine** ([ADR-0005](0005-applicability-engine.md)) — used
  by `api` (the scope checker) and `web` (static generation), and
- the **citation/provenance contract** ([ADR-0004](0004-citation-integrity.md))
  and, later, the bitemporal primitives
  ([ADR-0003](0003-bitemporal-data-model.md)) and shared output schemas.

CLAUDE.md requires that cross-cutting types and tooling be *shared rather than
duplicated*. None of the four named workspaces is the natural owner: `infra` is
IaC, and putting the engine in `api` would force `web` and `ingest` to reach
across an HTTP boundary or duplicate it.

This logic is also the highest-value, hardest piece and is the first thing being
built — before the pipeline, store, or AWS exist — so it must be unit-testable
in complete isolation.

## Decision

Add a fifth workspace, **`core`** (`@sust-reg/core`), holding **pure,
dependency-free domain logic**: regulation status states, the applicability
engine, the citation contract, and (as they arrive) the bitemporal primitives
and shared schemas. It performs no I/O and depends on no AWS service or web
framework. The other workspaces depend on it.

The first slice ships the status model and the applicability engine with seed
data for the California regime and full unit tests, runnable via Node's native
TypeScript type-stripping and built-in test runner — **zero dependencies**.

## Consequences

- Shared domain types and logic live exactly once; `ingest`, `api`, and `web`
  consume them without duplication or an HTTP hop.
- The non-interpretive ([ADR-0002](0002-primary-source-non-interpretive-scope.md))
  and citation-integrity ([ADR-0004](0004-citation-integrity.md)) invariants are
  centralized where they are easiest to enforce and test.
- The engine is testable before any pipeline or infrastructure exists, matching
  the build order (business logic first).
- The documented layout grows from four workspaces to five; README and
  CLAUDE.md are updated to match.

## Alternatives considered

- **Duplicate types/logic per workspace.** Rejected: guarantees drift, exactly
  what CLAUDE.md forbids.
- **Put the engine in `api` only.** Rejected: `web` (static generation) and
  `ingest` also need it; this would force duplication or a needless HTTP
  dependency.
- **Fold it into `infra`.** Rejected: `infra` is infrastructure-as-code, not
  domain logic.
