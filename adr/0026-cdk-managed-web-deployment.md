# 0026 — CDK-managed web deployment via BucketDeployment

- **Status:** Accepted
- **Date:** 2026-06-01

## Context

The web bucket is private behind CloudFront (ADR-0013, ADR-0023). Initially the
prerendered site (`web/dist`) was published with a manual `aws s3 sync` run after
`cdk deploy`, deliberately kept out of CDK. The stated reason was cost
discipline (ADR-0016): CDK's `BucketDeployment` runs a helper Lambda, and a
helper Lambda's log group defaults to **never expire** — unbounded CloudWatch
Logs that bill silently.

In practice the manual step is a footgun: it is easy to forget, has no cache
invalidation (a stale CloudFront cache serves old HTML after a deploy), is not
captured in the deploy command, and drifts from "deploy to verify." A favicon
change that "deployed" but never appeared is exactly the failure mode.

## Decision

Publish the site as part of `cdk deploy` with
`aws-s3-deployment.BucketDeployment`:

- `sources: [Source.asset('web/dist')]`, `destinationBucket: webBucket`,
  `prune: true` (removes objects no longer in the build, like `sync --delete`).
- `distribution` + `distributionPaths: ['/*']` so the deploy **invalidates the
  CloudFront cache** — new content is visible immediately.
- An **explicit 14-day `logGroup`** on the helper Lambda, which neutralizes the
  original objection: the log group is bounded exactly like every other Lambda's
  (ADR-0016), instead of defaulting to never-expire.

`web/dist` must be built (`npm run build -w web`) before `cdk synth`/`deploy`,
since BucketDeployment stages it as a CDK asset. This couples an infra deploy to
a prior web build — an acceptable, explicit ordering.

## Consequences

- One command (`cdk deploy SustReg-Serving`) publishes infra **and** site, with
  cache invalidation; no separate manual sync, no stale-cache surprises.
- The cost concern that justified the manual approach is handled by the bounded
  log group; net cost is still effectively $0 at this volume.
- `cdk synth` (and the infra tests that synthesize ServingStack) now require
  `web/dist` to exist; the web build must run first in CI and locally.
- Supersedes the "publish with `aws s3 sync`, kept out of CDK" note in the
  original serving design; the README and stack comments are updated to match.

## Alternatives considered

- **Keep the manual `aws s3 sync`.** Rejected: forgettable, no invalidation, not
  captured in the deploy — it already caused a "deployed but not visible" change.
- **`BucketDeployment` with the default log group.** Rejected: the helper
  Lambda's log group would never expire, the exact cost issue ADR-0016 guards
  against. The explicit 14-day group is what makes BucketDeployment acceptable.
- **A CI pipeline that runs `aws s3 sync` + `create-invalidation`.** Reasonable,
  but there is no CI deploy yet; folding it into `cdk deploy` keeps a single,
  reproducible path today and can move to CI later unchanged.
