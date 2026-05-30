# 0010 — Serverless snapshotting pipeline on AWS

- **Status:** Accepted
- **Date:** 2026-05-30

## Context

The corpus must be kept current by periodically checking authoritative sources
and recording new versions when they change. The workload is bursty and
infrequent (a scheduled poll of a handful of sources), and the project must run
indefinitely inside the AWS Always-Free envelope
([ADR-0016](0016-aws-always-free-cost-discipline.md)). Standing servers would
be wasteful and would not scale to zero.

## Decision

Build the snapshotting pipeline as **AWS serverless** components:

- **EventBridge Scheduler** fires the ingestor on a cron.
- **Lambda (ingestor)** fetches each source, hashes the content, compares
  against the last-seen hash, and **only on change** writes a new immutable
  snapshot. Fetch + parse + hash fits comfortably within the 15-minute Lambda
  ceiling.
- **S3** holds raw immutable snapshots, content-addressed
  ([ADR-0011](0011-content-addressed-snapshot-store.md)).
- **Aurora DSQL** holds the queryable bitemporal corpus, metadata index, and
  applicability data ([ADR-0012](0012-aurora-dsql-data-store.md)).
- **Lambda (differ)** runs `semdiff` **only when the content hash changed**,
  gating the costly external LLM calls
  ([ADR-0007](0007-change-detection-via-semdiff.md)).

## Consequences

- The pipeline scales to zero between scheduled runs and lives inside Always
  Free (Lambda 1M requests + 400,000 GB-seconds).
- The content-hash check is the central efficiency gate: it suppresses both
  redundant storage and redundant LLM spend.
- Lambdas must stay **out of any VPC that needs a NAT Gateway** (~$33/mo just to
  exist); DSQL and S3 are reachable without one
  ([ADR-0016](0016-aws-always-free-cost-discipline.md)).
- Postgres-on-Lambda connection pooling is a hazard; use a stateless
  HTTP/data-API driver rather than raw TCP pooling to avoid connection
  exhaustion under burst ([ADR-0012](0012-aurora-dsql-data-store.md)).

## Alternatives considered

- **Always-on server / container (ECS, EC2).** Rejected: pays for idle time on a
  workload that is idle almost always; doesn't fit Always Free.
- **Single mega-Lambda doing fetch + diff + write unconditionally.** Rejected:
  couples the cheap poll to the expensive LLM diff; the ingestor/differ split
  with a hash gate is what makes cost control possible.
