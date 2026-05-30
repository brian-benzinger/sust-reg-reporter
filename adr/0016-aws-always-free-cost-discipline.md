# 0016 — AWS Always-Free architecture and cost discipline

- **Status:** Accepted
- **Date:** 2026-05-30

## Context

The project is meant to live **indefinitely**, so it must run inside AWS's
ongoing **Always Free** tier rather than any expiring promotional allowance.
The AWS free tier changed in mid-2025: the old 12-month model is gone for new
accounts. New accounts choose a Free Plan or Paid Plan and get up to $200 in
credits ($100 on signup, $100 earnable); the Free Plan **closes after six
months or when credits run out**. A pre-July-2025 personal account is actually
preferable — its 12-month window is long gone, but the account stays open on
Always Free.

## Decision

**Architect strictly inside Always Free**, and if a new account is used, choose
the **Paid Plan** (not the time-boxed Free Plan) so the project does not get
shut off after six months. Confirm which account is used; prefer a
pre-July-2025 account if available.

Rely only on **Always Free** services for the always-on pipeline:

- Lambda: 1M requests + 400,000 GB-seconds
- DynamoDB: 25 GB
- CloudFront: 1 TB egress + 10M requests
- SQS: 1M requests
- Aurora DSQL: 100,000 DPUs + 1 GiB storage (ongoing)

S3 is **not** Always-Free for new accounts (legacy 12-month), but the small text
corpus is pennies a month ([ADR-0011](0011-content-addressed-snapshot-store.md)).

### Cost-discipline rules (non-negotiable, codified in CDK)

- **Set a budget alarm on day one at a $1 threshold.** Non-negotiable.
- **Avoid a NAT Gateway** (~$33/mo just to exist): keep Lambda out of any VPC
  that needs one ([ADR-0010](0010-serverless-snapshotting-pipeline.md)).
- **Set CloudWatch Logs retention (7–14 days)** or logs accumulate and bill
  silently.
- **Stay in a single region.**

## Consequences

- Several upstream decisions are driven by this envelope: Lambda Function URLs
  behind CloudFront instead of API Gateway
  ([ADR-0014](0014-lambda-function-urls-over-api-gateway.md)), static generation
  to avoid burning invocations ([ADR-0013](0013-static-generation-thin-api.md)),
  and Aurora DSQL's ongoing free tier ([ADR-0012](0012-aurora-dsql-data-store.md)).
- The architecture is deliberately bounded; features that would breach Always
  Free are out of scope by default.
- The guardrails are encoded in CDK ([ADR-0015](0015-cdk-for-infrastructure.md))
  so they can't silently drift.

## Alternatives considered

- **New account on the Free Plan.** Rejected for an indefinite project: it
  closes after six months / when credits run out.
- **Ignore cost guardrails and rely on low volume.** Rejected: NAT Gateways and
  unbounded log retention bill silently regardless of traffic; the $1 alarm is
  the backstop.
