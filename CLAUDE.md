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
ingest/     # Snapshotting pipeline: ingestor + differ Lambdas, source adapters
api/        # Thin interactive API: as-of slider, scope checker, diff view
web/        # Statically generated website (primary human surface)
infra/      # AWS CDK infrastructure as code
```

These are monorepo workspaces, not separate repos. Keep cross-cutting types and
tooling shared rather than duplicated.

## Architecture & platform constraints

- **AWS serverless**, single region: EventBridge Scheduler → ingestor Lambda →
  (on change) S3 content-addressed snapshot + differ Lambda → Aurora DSQL.
  ([ADR-0010](adr/0010-serverless-snapshotting-pipeline.md))
- **S3 snapshots are immutable and content-addressed** (keyed by hash). Never
  overwrite; identical content is stored once.
  ([ADR-0011](adr/0011-content-addressed-snapshot-store.md))
- **Aurora DSQL** is the store, accessed via a **stateless HTTP/data-API
  driver** (never raw TCP pooling from Lambda — connection exhaustion).
  Remember DSQL is Postgres-*compatible*, not full Postgres: verify range types,
  exclusion constraints, FKs, and pgvector before relying on them; otherwise
  enforce integrity in application code.
  ([ADR-0012](adr/0012-aurora-dsql-data-store.md))
- **Serving:** statically generate most pages; reserve the thin API for the
  three interactive features. Expose the API via **Lambda Function URLs behind
  CloudFront** — not API Gateway.
  ([ADR-0013](adr/0013-static-generation-thin-api.md),
  [ADR-0014](adr/0014-lambda-function-urls-over-api-gateway.md))
- **IaC is CDK** in `infra/`. ([ADR-0015](adr/0015-cdk-for-infrastructure.md))

## Cost discipline (codify in CDK, never click-ops)

The project must run indefinitely inside AWS **Always Free**
([ADR-0016](adr/0016-aws-always-free-cost-discipline.md)):

- **$1 budget alarm on day one. Non-negotiable.**
- **No NAT Gateway** (~$33/mo to exist) — keep Lambda out of VPCs that need one.
- **CloudWatch Logs retention 7–14 days** or logs bill silently.
- **Single region.**

When adding infrastructure, check it against Always Free before introducing it.
If a feature can't fit, surface the cost rather than quietly adding billable
resources.

## Quality bar (the actual contribution)

The senior-level signal is the unglamorous engineering, not the prompt
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

- **Branch:** develop on `claude/sust-reg-tracker-brief-WYye9`. Do not push to
  `main` without explicit permission.
- **Commits:** clear, descriptive messages.
- **Pull requests:** always open a PR for your changes once they're pushed.
- **Scope:** v1 is exactly three regimes — California SB 253/261, EU CSRD
  (post-Omnibus), ISSB S1/S2. Don't add regimes without a decision.
  ([ADR-0009](adr/0009-v1-scope-three-regimes.md))
- **Decisions:** record significant architectural/product choices as a new ADR
  in `adr/` following the existing MADR-style template; ADRs are immutable —
  supersede, don't edit. ([ADR-0000](adr/0000-record-architecture-decisions.md))

## Build order (when implementation starts)

1. `semdiff` (separate repo): engine, CLI, eval harness.
2. This repo: ingestion pipeline + bitemporal schema + applicability engine.
3. Web app: static generation + the thin interactive API.
