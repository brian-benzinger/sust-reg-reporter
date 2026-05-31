# sust-reg-reporter

> Version-tracked climate disclosure regulations with point-in-time history,
> sourced citations, and per-company applicability.

**Status:** early implementation. The design of record ([`adr/`](adr/)) is
complete; the shared domain logic and the first AWS infrastructure stacks are
built, tested, and deployed. See [Implementation status](#implementation-status)
for what exists today, and [`adr/`](adr/) for the rationale behind every
decision.

> ⚠️ **Not legal advice.** This tool returns primary-source text, citations,
> effective dates, and applicability metadata. It does **not** interpret
> regulations or provide legal advice. Always verify against the cited primary
> source and consult qualified counsel.

---

## What this is

A version-tracked corpus of climate and sustainability **disclosure**
regulations, exposed primarily through a website and a thin API.

The differentiating feature is **tracking how regulations change over time** —
point-in-time history and structured, meaning-aware diffs. It is deliberately
**not** an emissions calculator and **not** a generic scraper. The
emissions-calculator space is saturated; the regulation change-tracking space
is open.

Every answer pins to primary source text, an exact citation span, a version,
an effective date, and a retrieval date. That constraint is both the safety
posture and the source of trust.

## The two repositories

This project is built as **two repositories** — a deliberate target, not an
interim state ([ADR-0001](adr/0001-two-repo-structure.md)).

| Repo | Tagline | Role |
| --- | --- | --- |
| **`semdiff`** | Meaning-aware diff engine and CLI that surfaces substantive changes in prose, not cosmetic edits | The reusable, domain-neutral engine. Standalone library + CLI + eval harness. No backend. |
| **`sust-reg-reporter`** (this repo) | Version-tracked climate disclosure regulations with point-in-time history, sourced citations, and per-company applicability | The application. Depends on `semdiff`. An internal monorepo. |

The engine's name is kept domain-neutral so it reads as a standalone,
general-purpose tool with reach beyond this project; the application carries
the `sust-reg-` prefix that signals its domain.

### Monorepo workspaces (this repo)

```
sust-reg-reporter/
├── adr/        # Architecture Decision Records (the design of record)
├── core/       # Pure, dependency-free domain logic shared across workspaces
├── ingest/     # Snapshotting pipeline: ingestor + differ Lambdas, source adapters
├── api/        # Thin interactive API (as-of slider, scope checker, diff view)
├── web/        # Statically generated website (primary human surface)
└── infra/      # AWS CDK infrastructure as code
```

### Implementation status

**Domain logic** — [`core/`](core/) ([ADR-0018](adr/0018-shared-core-domain-workspace.md)):
the explicit **regulation status states** ([ADR-0006](adr/0006-explicit-regulation-status-states.md))
and the **applicability engine** ([ADR-0005](adr/0005-applicability-engine.md)),
with California SB 253/261 seed data. Pure — no I/O, no AWS, no framework, and no
runtime dependencies.

**Quality bar** — tests run on **Vitest** with a hard **per-file coverage gate
(95% line / 90% branch)**, enforced locally and in CI
([ADR-0019](adr/0019-vitest-testing-and-coverage.md)).

**Infrastructure** — AWS CDK in [`infra/`](infra/), deployed to **us-west-2**:

- `CostStack` — the **$1 monthly budget** backstop (ADR-0016), live with
  80% / 100% email alerts.
- `DataStack` — the **content-addressed S3 snapshot store** (ADR-0011):
  versioned, object-locked, private, and retained.
- Cost-discipline **guardrail Aspects** fail `cdk synth` on a NAT Gateway, a
  VPC, API Gateway, an ALB, an unbounded log group, or a stray region.

Still to come: Aurora DSQL, the ingest/differ pipeline, the thin API, and the
web site.

```sh
npm test                            # unit tests + per-file coverage gate
npm run typecheck                   # tsc over core + infra
npm run synth -w @sust-reg/infra    # synthesize the CloudFormation templates
```

## v1 scope

Three high-churn, well-documented regimes — and no more
([ADR-0009](adr/0009-v1-scope-three-regimes.md)):

- **California SB 253 and SB 261**
- **EU CSRD** (post-Omnibus)
- **ISSB S1 and S2**

This is enough to prove the bitemporal model, the diff engine, and the
applicability logic without drowning in global coverage.

## Core design principles

- **Primary-source pinned, not interpretive.** Return source text, citations,
  effective dates, and applicability. Do not advise.
  ([ADR-0002](adr/0002-primary-source-non-interpretive-scope.md))
- **Bitemporal data model.** Two time axes — *valid time* (when a rule was
  actually in effect) and *transaction time* (when we recorded it) — so the
  system can answer both "what was in effect on date D" and "what did we
  believe was in effect as of our ingestion on D."
  ([ADR-0003](adr/0003-bitemporal-data-model.md))
- **Citation integrity.** Every answer pins to an exact source span, version,
  and retrieval date. This is the anti-hallucination architecture and is
  non-negotiable. ([ADR-0004](adr/0004-citation-integrity.md))
- **Applicability engine.** Given a company profile (revenue, jurisdictions,
  listing status, fiscal year end), determine which obligations apply and by
  when. This is conditional logic, not lookup — the highest-value, hardest
  piece. ([ADR-0005](adr/0005-applicability-engine.md))
- **Explicit status states.** A regulation can be *proposed*, *in-effect*,
  *enforced*, or *stayed*. SB 261, for instance, has been law while enforcement
  was paused pending appeal. A naive tool gets this catastrophically wrong.
  ([ADR-0006](adr/0006-explicit-regulation-status-states.md))
- **Change detection and diffing.** Structured, meaning-aware diffs (via
  `semdiff`) when a source changes — the recurring-value engine.
  ([ADR-0007](adr/0007-change-detection-via-semdiff.md))
- **Authoritative-source ingestion with provenance.** Pull from official APIs
  (Federal Register API, EUR-Lex, SEC EDGAR, the CARB docket), not brittle HTML
  scraping. ([ADR-0008](adr/0008-authoritative-source-ingestion.md))

## Architecture

### Snapshotting pipeline (AWS, serverless)

```
EventBridge Scheduler ──(cron)──▶ Lambda (ingestor)
                                     │ fetch each source, hash content
                                     │ compare to last-seen hash
                                     ▼
                       hash unchanged?  ──▶ stop (no cost)
                                     │
                              hash changed
                          ┌──────────┴───────────┐
                          ▼                       ▼
              S3 (immutable snapshot,    Lambda (differ) runs semdiff
              content-addressed)         (LLM calls gated to actual change)
                          │                       │
                          └──────────┬────────────┘
                                     ▼
                          Aurora DSQL (bitemporal corpus,
                          metadata index, applicability data)
```

- **EventBridge Scheduler** fires the ingestor on a cron.
- **Lambda (ingestor)** fetches, hashes, compares, and only-on-change writes a
  new immutable snapshot. Fetch + parse + hash fits the 15-minute Lambda
  ceiling. ([ADR-0010](adr/0010-serverless-snapshotting-pipeline.md))
- **S3** holds raw immutable snapshots keyed by content hash — identical
  content is never stored twice, every version is preserved.
  ([ADR-0011](adr/0011-content-addressed-snapshot-store.md))
- **Aurora DSQL** holds the queryable bitemporal corpus, metadata index, and
  applicability data. ([ADR-0012](adr/0012-aurora-dsql-data-store.md))
- **Lambda (differ)** runs `semdiff` **only when the content hash changed**,
  gating the costly, external, nondeterministic LLM calls.
  ([ADR-0007](adr/0007-change-detection-via-semdiff.md))

### Serving

The website is the primary human surface — demoable, indexable, usable by
non-developers. Most pages are **statically generated** from the database so
reads don't burn function invocations. A **thin API** is reserved for the three
interactive features that surface the engineering depth
([ADR-0013](adr/0013-static-generation-thin-api.md)):

- an **as-of-date slider** — the bitemporal model made visible,
- a **scope checker** — the applicability engine made visible,
- a **diff view** — change detection made visible.

The API is served by **Lambda Function URLs behind CloudFront** (not API
Gateway), because CloudFront egress is Always Free while API Gateway's free
allowance is legacy-only ([ADR-0014](adr/0014-lambda-function-urls-over-api-gateway.md)).

### Infrastructure

All infrastructure is **AWS CDK** in [`infra/`](infra/)
([ADR-0015](adr/0015-cdk-for-infrastructure.md)).

## Data store

**Aurora DSQL** — PostgreSQL-compatible, AWS-native, serverless, scales to
zero, with an ongoing Always-Free tier (100,000 DPUs + 1 GiB/month). The two
core access patterns (point-in-time bitemporal lookup and conditional
applicability) are relational by nature; applicability reads naturally as a SQL
`WHERE` clause. ([ADR-0012](adr/0012-aurora-dsql-data-store.md))

**Caveats to verify before relying on them:**

- DSQL is PostgreSQL-*compatible*, not full Postgres — extension support is
  limited (verify **pgvector** if semantic citation search is wanted).
- The `tstzrange` + GiST exclusion-constraint approach for non-overlapping valid
  periods may not be supported; if not, enforce in application code.
- There are restrictions on certain `ALTER` operations on large tables.

**Fallbacks:** Neon (full Postgres, free tier, HTTP driver) or DynamoDB
(always-free, but fights the relational access patterns). On Lambda, always use
a **stateless HTTP driver** rather than raw TCP pooling, or connection
exhaustion will bite under burst.

## Cost discipline

The project is meant to live **indefinitely**, so it is architected strictly
inside AWS **Always Free** ([ADR-0016](adr/0016-aws-always-free-cost-discipline.md)).

- **Set a budget alarm on day one at a $1 threshold.** Non-negotiable.
- **Avoid a NAT Gateway** (~$33/mo just to exist) — keep Lambda out of any VPC
  that needs one.
- **Set CloudWatch Logs retention (7–14 days)** or logs bill silently.
- **Stay in a single region.**
- If using a new AWS account, choose the **Paid Plan** (not the six-month Free
  Plan) and stay inside Always Free. A pre-July-2025 personal account is
  preferable for indefinite free hosting.

## Reliability is the contribution

An LLM in a loop is nondeterministic, costs per call, and is wrong some
percentage of the time. The unglamorous engineering — schema validation,
retries, idempotency, caching, confidence flags, an eval harness, graceful
failure — is the actual contribution. The product
is scoped to where **~90–95% correctness with human review beats the status
quo**; nothing here is built to silently need four-nines accuracy.
([ADR-0017](adr/0017-reliability-and-quality-layer.md))

## Architecture Decision Records

The full rationale lives in [`adr/`](adr/). Start with the
[index](adr/README.md).

## Open questions

- Verify Aurora DSQL feature support for the bitemporal model (range types,
  exclusion constraints, foreign keys, and pgvector for semantic search).
- Confirm which AWS account is used (a pre-July-2025 account is preferable for
  indefinite free hosting).
- Confirm domain availability for the chosen names on a registrar.

## Suggested build order

1. **`semdiff`** first — the dependency *and* a standalone deliverable. Build
   the engine, the CLI, and the eval harness.
2. **`sust-reg-reporter` ingestion + schema** — the snapshotting pipeline, the
   bitemporal data model, and the applicability engine.
3. **The web app** last — generated mostly statically from the corpus, with the
   thin interactive API for the slider, scope checker, and diff view.

## License

[MIT](LICENSE) © 2026 Brian Benzinger
