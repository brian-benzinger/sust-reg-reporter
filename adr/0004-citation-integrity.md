# 0004 — Citation integrity as anti-hallucination architecture

- **Status:** Accepted
- **Date:** 2026-05-30

## Context

The system uses LLMs (for diffing and structuring) and operates in a legal
domain where a fabricated or misattributed citation is a catastrophic failure,
not a cosmetic one. The non-interpretive posture
([ADR-0002](0002-primary-source-non-interpretive-scope.md)) only delivers trust
if every claim can be traced to its primary source.

## Decision

**Citation integrity is non-negotiable.** Every answer pins to:

- an **exact source span**,
- a specific **version** of the source, and
- the **retrieval date**.

This is treated as the anti-hallucination architecture: the system never
asserts a regulatory fact it cannot anchor to a stored, content-addressed
source span. LLM output that cannot be grounded against the retained source is
rejected or flagged rather than served.

## Consequences

- Citations resolve against the immutable, content-addressed snapshot store
  ([ADR-0011](0011-content-addressed-snapshot-store.md)), so a citation is
  stable and reproducible even after the source changes upstream.
- Combined with bitemporality ([ADR-0003](0003-bitemporal-data-model.md)), a
  citation is pinned in both space (the span) and time (the version + retrieval
  date).
- Schema validation and confidence flags in the quality layer
  ([ADR-0017](0017-reliability-and-quality-layer.md)) enforce that ungrounded
  output cannot silently reach users.
- It constrains the LLM's role: the model locates and characterizes change, it
  does not become the source of truth.

## Alternatives considered

- **Free-text answers with best-effort references.** Rejected: invites
  hallucinated or imprecise citations, which is fatal in this domain.
- **Citing live upstream URLs only.** Rejected: upstream content mutates and
  link-rots; a citation must resolve to the exact retained version.
