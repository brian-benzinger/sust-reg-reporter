# 0017 — Reliability and quality layer as the core contribution

- **Status:** Accepted
- **Date:** 2026-05-30

## Context

The system puts an LLM in a loop (diffing, structuring). An LLM is
nondeterministic, costs per call, and is wrong some percentage of the time. A
thin API wrapper around a model gets cloned in a weekend; the durable,
senior-level signal is the *unglamorous* engineering around the model, not the
prompt.

## Decision

Treat the **reliability and quality layer as the core contribution**, and build
it explicitly:

- **schema validation** of all model output,
- **retries** and **idempotency** in the pipeline,
- **caching** (the content-hash gate;
  [ADR-0011](0011-content-addressed-snapshot-store.md)),
- **confidence flags** on generated output,
- an **eval harness** (the real contribution in `semdiff`, not the prompt;
  [ADR-0007](0007-change-detection-via-semdiff.md)),
- **graceful failure**.

Scope the product to where **~90–95% correctness with human review beats the
status quo**. Do not build anything that silently requires four-nines accuracy.

## Consequences

- Ungrounded or low-confidence model output is flagged or rejected rather than
  served, reinforcing citation integrity
  ([ADR-0004](0004-citation-integrity.md)) and the non-interpretive posture
  ([ADR-0002](0002-primary-source-non-interpretive-scope.md)).
- Idempotency + the content-hash gate mean re-runs are safe and cheap; retries
  don't duplicate snapshots or re-bill LLM calls
  ([ADR-0010](0010-serverless-snapshotting-pipeline.md)).
- A human-in-the-loop review step is an accepted part of the workflow, not a
  failure — it is how the 90–95% bar is made trustworthy.
- The eval harness gates diff quality and makes nondeterministic output
  measurable and regression-tested.

## Alternatives considered

- **Trust raw LLM output and serve it directly.** Rejected: nondeterministic and
  wrong often enough to be dangerous in a legal domain.
- **Chase four-nines automated accuracy with no human review.** Rejected:
  out of reach for an LLM-in-the-loop system and not the scoped goal.
