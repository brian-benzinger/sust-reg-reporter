# CLAUDE.md

Guidance for Claude Code (and other AI agents) working in this repository.

## What this project is

`sust-reg-reporter` is the **application** half of a two-repo system that
tracks how climate/sustainability **disclosure** regulations change over time.
It returns primary-source text, citations, effective dates, and per-company
applicability — it does **not** interpret law or give advice.

The other repo is **`semdiff`**: a domain-neutral, meaning-aware diff engine +
CLI + library that this app depends on. Do not fold `semdiff` into this repo,
and do not give it a regulation-specific identity — its neutrality is
deliberate ([ADR-0001](adr/0001-two-repo-structure.md)).

Read [`README.md`](README.md) for the product overview and [`adr/`](adr/) for
the binding design rationale. **The ADRs are the design of record.** When a
task touches a decision an ADR covers, follow the ADR; if you believe an ADR is
wrong, propose a *new superseding ADR* rather than silently diverging.

## Non-negotiable invariants

These are safety- and trust-critical. Do not relax them without an explicit,
recorded decision:

1. **Never give legal advice or interpret regulations.** Return source text,
   citations, effective dates, and applicability metadata only.
   ([ADR-0002](adr/0002-primary-source-non-interpretive-scope.md))
2. **Every regulatory claim must be grounded in a stored source span**, pinned
   to a version and retrieval date. Ungrounded or low-confidence LLM output is
   flagged or rejected — never served as fact.
   ([ADR-0004](adr/0004-citation-integrity.md),
   [ADR-0017](adr/0017-reliability-and-quality-layer.md))
3. **The data model is bitemporal.** Preserve both *valid time* and
   *transaction time*; never destroy prior versions or mutate records in place.
   ([ADR-0003](adr/0003-bitemporal-data-model.md))
4. **Regulation status is an explicit enum** (proposed / in-effect / enforced /
   stayed), not a boolean. The SB 261 "law-but-enforcement-stayed" case must be
   representable. ([ADR-0006](adr/0006-explicit-regulation-status-states.md))
5. **Gate LLM calls behind the content-hash check.** The differ runs `semdiff`
   *only when content changed*. LLM calls cost real money and are external to
   AWS. ([ADR-0007](adr/0007-change-detection-via-semdiff.md))
6. **Ingest from authoritative sources/official APIs with provenance**, not
   brittle HTML scraping. ([ADR-0008](adr/0008-authoritative-source-ingestion.md))

## Repository layout

```
adr/        # Architecture Decision Records — the design of record
core/       # Pure, dependency-free domain logic shared across workspaces (ADR-0018)
ingest/     # Snapshotting pipeline: ingestor + differ Lambdas, source adapters
api/        # Thin interactive API: as-of slider, scope checker, diff view
web/        # Statically generated website (primary human surface)
infra/      # AWS CDK infrastructure as code
```

`core` is pure domain logic (status states, applicability engine, citation
contract, bitemporal resolver) with no I/O, no AWS, and no runtime
dependencies. Tests run on **Vitest** with a hard **per-file coverage gate
(95% line / 90% branch)** enforced locally and in CI
([ADR-0019](adr/0019-vitest-testing-and-coverage.md)); run `npm install`, then
`npm test`.

These are monorepo workspaces, not separate repos. Keep cross-cutting types and
tooling shared rather than duplicated.

## Architecture & platform constraints

- **AWS serverless**, single region: EventBridge Scheduler → ingestor Lambda →
  (on change) S3 content-addressed snapshot + differ Lambda → Aurora DSQL.
  ([ADR-0010](adr/0010-serverless-snapshotting-pipeline.md))
- **S3 snapshots are immutable and content-addressed** (keyed by hash). Never
  overwrite; identical content is stored once.
  ([ADR-0011](adr/0011-content-addressed-snapshot-store.md))
- **Aurora DSQL** is the store, reached over its **public TLS endpoint with
  IAM-token auth, connecting per invocation** (never a long-lived TCP pool from
  Lambda — connection exhaustion; no VPC needed). DSQL is Postgres-*compatible*,
  not full Postgres: verify range types, exclusion constraints, FKs, and
  pgvector before relying on them; otherwise enforce integrity in application
  code. ([ADR-0012](adr/0012-aurora-dsql-data-store.md))
- **Serving:** statically generate most pages; reserve the thin API for the
  three interactive features. Expose the API via an **API Gateway HTTP API
  behind CloudFront** — the Lambda is never public and the endpoint is throttled
  ([ADR-0023](adr/0023-api-gateway-http-api.md) supersedes the original Lambda
  Function URL approach). ([ADR-0013](adr/0013-static-generation-thin-api.md))
- **IaC is CDK** in `infra/`. ([ADR-0015](adr/0015-cdk-for-infrastructure.md))

## Cost discipline (codify in CDK, never click-ops)

The project must run indefinitely inside AWS **Always Free**
([ADR-0016](adr/0016-aws-always-free-cost-discipline.md)):

- **$1 budget alarm on day one. Non-negotiable.**
- **No NAT Gateway** (~$33/mo to exist) — keep Lambda out of VPCs that need one.
- **CloudWatch Logs retention 7–14 days** or logs bill silently.
- **Single region.**
- **Secrets in SSM `SecureString`**, not Secrets Manager ($0.40/secret/mo) —
  free and encrypted ([ADR-0024](adr/0024-ssm-securestring-secrets.md)).
- **API Gateway HTTP API** is billable but pennies/month at this volume
  ([ADR-0023](adr/0023-api-gateway-http-api.md)); REST API and ALB stay out.
- **The $1 AWS budget alarm does NOT cover Anthropic/Claude spend** (billed
  outside AWS). The differ is content-hash-gated and async-only; set a spend cap
  in the Anthropic console as the backstop.

When adding infrastructure, check it against Always Free before introducing it.
If a feature can't fit, surface the cost rather than quietly adding billable
resources.

## Quality bar (the actual contribution)

The unglamorous engineering is the contribution, not the prompt
([ADR-0017](adr/0017-reliability-and-quality-layer.md)):

- Validate all model output against a schema.
- Make the pipeline **idempotent** and **retry-safe**; re-runs must not
  duplicate snapshots or re-bill LLM calls.
- Attach **confidence flags**; degrade gracefully.
- `semdiff` has an **eval harness** — the determinism/quality layer is the real
  deliverable. Add/adjust evals when you touch diff behavior.
- Scope to ~90–95% correctness with human review. Do not build anything that
  silently requires four-nines accuracy.

## Working agreements

- **Branch & PRs:** work in **small, focused topic branches off `main`** and
  open a **PR per change** (merge each before the next builds on it). Never push
  directly to `main`. Keep PRs bite-sized and reviewable.
- **Commits:** clear, descriptive messages.
- **Deploy to verify:** after a CDK change, actually `cdk deploy` (not just
  `synth`) and confirm the live resource — consistently.
- **Scope:** v1 is exactly three regimes — California SB 253/261, EU CSRD
  (post-Omnibus), ISSB S1/S2. Don't add regimes without a decision.
  ([ADR-0009](adr/0009-v1-scope-three-regimes.md))
- **Decisions:** record significant architectural/product choices as a new ADR
  in `adr/` following the existing MADR-style template; ADRs are immutable —
  supersede, don't edit. ([ADR-0000](adr/0000-record-architecture-decisions.md))

## Current state & what's next

Built and deployed: `semdiff@0.1.0` (separate repo, integrated here), the `core`
domain logic, all four CDK stacks (cost / data + DSQL / pipeline / serving —
live in us-west-2), and the prerendered web app. The change-detection path is
wired end to end (the differ runs `semdiff`, content-hash-gated and async-only).

Next: source adapters (ADR-0008) + the ingestor's S3 write; the differ reading
snapshot text from S3 and persisting the diff to DSQL; the corpus-backed API
endpoints; and pointing the web app at the live `/api`.
