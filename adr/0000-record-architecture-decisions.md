# 0000 — Record architecture decisions

- **Status:** Accepted
- **Date:** 2026-05-30

## Context

This project makes a number of consequential, opinionated choices: a
bitemporal data model, a specific data store, a serverless ingestion
pipeline, a deliberate two-repo split, and a non-interpretive product scope
that is as much a safety posture as a feature decision. Many of these choices
have non-obvious rationale and explicit caveats that must be verified before
they are relied upon.

For a project whose entire premise is that *change over time matters* and that
*citations and provenance are non-negotiable*, it would be incoherent not to
keep a primary-source, version-tracked record of our own design reasoning.

## Decision

We will capture significant architectural and product decisions as
Architecture Decision Records (ADRs) stored in `adr/`, using a lightweight
MADR-style template. Records are numbered sequentially and are immutable once
accepted; a decision is changed by writing a new ADR that supersedes the old
one rather than by editing history.

## Consequences

- New contributors (and reviewers) can reconstruct *why* the system looks the
  way it does without archaeology through commits or chat logs.
- The caveats attached to risky decisions (e.g. Aurora DSQL feature gaps) live
  next to the decision, so they are revisited rather than forgotten.
- There is a small ongoing cost: every significant decision now warrants a
  short writeup. This is intentional friction.

## Alternatives considered

- **No formal record.** Rejected: rationale evaporates and gets relitigated.
- **A single design doc.** Rejected: monolithic docs rot, conflate unrelated
  decisions, and obscure when and why each choice changed.
