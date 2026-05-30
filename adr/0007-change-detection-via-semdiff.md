# 0007 — Change detection and diffing gated through semdiff

- **Status:** Accepted
- **Date:** 2026-05-30

## Context

A tool that snapshots a regulation once has no reason to be revisited. The
recurring value is in detecting and explaining *substantive* changes when a
source is amended. Raw textual diffs are noisy: reformatting, renumbering, and
boilerplate churn drown out the handful of edits that actually change meaning.

LLM calls cost real money, are external to AWS, and are nondeterministic, so
they must not run on every fetch.

## Decision

Use **`semdiff`** ([ADR-0001](0001-two-repo-structure.md)) — the meaning-aware
diff engine — to produce structured diffs that surface substantive changes and
ignore cosmetic edits. Gate it strictly behind a content-hash check: the
**differ** Lambda runs `semdiff` **only when the content hash of a source has
changed** ([ADR-0010](0010-serverless-snapshotting-pipeline.md)).

## Consequences

- LLM cost is incurred only on actual change, not on every scheduled poll —
  the hash check is the cost gate around the expensive, external, nondeterministic
  step.
- Structured diffs become first-class corpus objects, powering the **diff view**
  interactive feature ([ADR-0013](0013-static-generation-thin-api.md)) — change
  detection made visible.
- `semdiff`'s eval harness is the determinism/quality layer that makes diff
  output trustworthy; the prompt is not the contribution
  ([ADR-0017](0017-reliability-and-quality-layer.md)).
- Diff output is grounded in stored source spans
  ([ADR-0004](0004-citation-integrity.md)), so "what changed" is itself citable.

## Alternatives considered

- **Plain textual/line diff only.** Rejected: too noisy; cosmetic edits swamp
  substantive ones, defeating the purpose.
- **Run the LLM diff on every fetch.** Rejected: needless cost and
  nondeterminism on unchanged content; the hash gate eliminates it.
