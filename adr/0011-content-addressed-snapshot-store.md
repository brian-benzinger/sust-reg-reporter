# 0011 — Content-addressed S3 snapshot store

- **Status:** Accepted
- **Date:** 2026-05-30

## Context

Citation integrity ([ADR-0004](0004-citation-integrity.md)) requires that every
cited span resolve to the exact version of the source it was drawn from, even
after the upstream source changes. The bitemporal model
([ADR-0003](0003-bitemporal-data-model.md)) requires that prior versions are
never destroyed. We also poll sources repeatedly, most of which are unchanged
most of the time.

## Decision

Store the raw immutable snapshots in **S3, keyed by content hash**
(content-addressed). Identical content is therefore never stored twice, and
every distinct version is preserved permanently. The relational corpus
([ADR-0012](0012-aurora-dsql-data-store.md)) references snapshots by hash.

## Consequences

- The content hash is reused as the change gate for the ingestor and differ
  ([ADR-0010](0010-serverless-snapshotting-pipeline.md)): "is this hash new?"
  answers both "store it?" and "diff it?".
- Citations and bitemporal records point at an immutable, reproducible blob, so
  a citation never silently drifts when the upstream source is edited.
- Deduplication keeps storage tiny; a small text corpus is pennies a month even
  though S3 is not Always-Free for new accounts
  ([ADR-0016](0016-aws-always-free-cost-discipline.md)).
- Snapshots are write-once; no update/delete path is needed in normal
  operation, which simplifies correctness.

## Alternatives considered

- **Overwrite-in-place "latest" object.** Rejected: destroys history and breaks
  both citation stability and bitemporality.
- **Store every fetch under a timestamped key regardless of content.** Rejected:
  stores redundant copies and loses the natural dedup/change signal the hash
  provides.
- **Store raw text in the database.** Rejected: bloats the relational store,
  wastes its small free quota, and conflates the immutable blob layer with the
  queryable index.
