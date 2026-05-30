# 0001 — Two-repo structure: semdiff engine + reporter monorepo

- **Status:** Accepted
- **Date:** 2026-05-30

## Context

The project has two separable concerns:

1. A **meaning-aware diff engine** that surfaces substantive changes in prose
   and ignores cosmetic edits. This capability is domain-agnostic and broadly
   useful well beyond regulation tracking.
2. The **regulation tracking application** itself: the bitemporal corpus, the
   ingestion and snapshotting pipeline, the applicability engine, the API, the
   web app, and the infrastructure.

The emissions-calculator space is saturated; the regulation change-tracking
space is open. The diff engine is the reusable, independently adoptable piece.

## Decision

Build exactly **two repositories**:

1. **`semdiff`** — a standalone diff engine, CLI, and library. Domain-neutral
   by name and by capability. It has no backend. The neutral name is
   deliberate: it preserves standalone, general-purpose positioning so
   developers who just want a semantic-diff CLI can find and adopt it.
2. **`sust-reg-reporter`** — the application. It depends on `semdiff` and is an
   internal **monorepo** with workspaces for `ingest`, `api`, `web`, and
   `infra`.

Two repos is the deliberate target, not an interim state.

## Consequences

- `semdiff` stays discoverable and adoptable on its own merits; its README and
  positioning never mention regulations as a requirement.
- The reporter's four concerns (ingest/api/web/infra) share tooling, types,
  and a single version line via workspaces — no cross-repo version juggling
  for what is fundamentally one deployable system.
- One genuine cross-repo dependency exists (`reporter` → `semdiff`), managed
  like any other versioned dependency.

## Alternatives considered

- **One monorepo for everything.** Rejected: it would bury `semdiff` inside a
  domain-specific project and kill its standalone discoverability.
- **Four+ repos (split ingest/api/web/infra).** Rejected: more repos is not
  more impressive; cross-repo version juggling is pure overhead for a solo
  developer, and these pieces are one system.
- **A third repo now for the ingestion framework.** Deferred: only justified
  later *if* the ingestion framework proves reusable across other projects.
