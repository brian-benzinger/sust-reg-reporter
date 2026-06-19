# sust-reg-reporter

> Version-tracked climate disclosure regulations with point-in-time history,
> sourced citations, and per-company applicability.

**Status:** **built, tested, and deployed live** to AWS (us-west-2), end to end.
**Live at [disclosurelab.dev](https://disclosurelab.dev)** (`www` redirects to
the apex; HTTPS via CloudFront + ACM).
The snapshotting pipeline ingests authoritative sources, content-hash-gates each
fetch, and runs `semdiff` only on change; the bitemporal corpus (obligations,
append-only status history, and append-only grounding facts) is persisted in
Aurora DSQL and served through a thin API behind CloudFront; and the prerendered
web app reads that live corpus. Obligations are **grounded** to their ingested
snapshots ([ADR-0028](adr/0028-ground-obligations-via-append-only-grounding-facts.md)),
so the grounded vs. ungrounded distinction is visible across the site. See
[Implementation status](#implementation-status) for specifics, and [`adr/`](adr/)
for the rationale behind every decision.

> ⚠️ **Not legal advice.** This tool returns primary-source text, citations,
> effective dates, and applicability metadata. It does **not** interpret
> regulations or provide legal advice. Always verify against the cited primary
> source and consult qualified counsel.

---

## What this is

A version-tracked corpus of climate and sustainability **disclosure**
regulations, exposed primarily through a website and a thin API.

The differentiating feature is **tracking how regulations change over time**:
point-in-time history and structured, meaning-aware diffs. It is deliberately
**not** an emissions calculator and **not** a generic scraper. The
emissions-calculator space is saturated; the regulation change-tracking space
is open.

Every answer pins to primary source text, an exact citation span, a version,
an effective date, and a retrieval date. That constraint is both the safety
posture and the source of trust.

## The two repositories

This project is built as **two repositories**: a deliberate target, not an
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

**Domain logic**: [`core/`](core/) ([ADR-0018](adr/0018-shared-core-domain-workspace.md)):
the explicit **regulation status states** ([ADR-0006](adr/0006-explicit-regulation-status-states.md)),
the **applicability engine** ([ADR-0005](adr/0005-applicability-engine.md)), and
a **bitemporal resolver** ([ADR-0003](adr/0003-bitemporal-data-model.md),
[ADR-0022](adr/0022-in-code-bitemporal-representation.md)) that answers
"what was in effect on D, as we knew it on K", with California SB 253/261 seed
data and a versioned SB 261 status history. Pure, no I/O, no AWS, no framework,
and no runtime dependencies.

**Quality bar**: tests run on **Vitest** with a hard **per-file coverage gate
(95% line / 90% branch)**, enforced locally and in CI
([ADR-0019](adr/0019-vitest-testing-and-coverage.md)).

**Infrastructure**: AWS CDK in [`infra/`](infra/), all six stacks **deployed
live** (us-west-2, except the CloudFront certificate, which must be us-east-1):

- `CostStack`: the **$1 monthly budget** backstop (ADR-0016), with 80% / 100%
  email alerts (the alert address is supplied at deploy via the
  `SUSTREG_BUDGET_EMAIL` env var, never hardcoded).
- `DataStack`: the **content-addressed S3 snapshot store** (ADR-0011:
  versioned, object-locked, private, retained) and the **Aurora DSQL** cluster
  (ADR-0012), ACTIVE and deletion-protected.
- `PipelineStack`: the snapshotting pipeline (ADR-0010): an EventBridge daily
  cron → ingestor + **differ** Lambdas (the differ runs `semdiff`), an SQS DLQ,
  and 14-day log groups. It is **monitored** (ADR-0033): CloudWatch alarms for a
  stalled daily poll, ingestor/differ errors, and a non-empty DLQ fan out to an
  **SNS email** topic, with a pipeline **dashboard** — health monitoring kept
  distinct from the `$1` **cost** alarm above.
- `ServingStack`: one **CloudFront** distribution fronting the static site and
  the thin API (`/api/*`) via an **API Gateway HTTP API** → Lambda (ADR-0013,
  ADR-0023), served on the **custom domain** (apex + `www`) over HTTPS.
- `DnsStack` + `CertUsEast1`: the Route 53 hosted zone and the ACM certificate
  for **[disclosurelab.dev](https://disclosurelab.dev)** — registered at Vercel,
  DNS delegated to Route 53, `www` 301s to the apex (ADR-0031, ADR-0032).
- Cost-discipline **guardrail Aspects** fail `cdk synth` on a NAT Gateway, a
  VPC, a REST API, an ALB, an unbounded log group, or a stray region (bar the
  one named us-east-1 certificate stack, ADR-0032).

The change-detection path is wired and verified end to end:
[`semdiff@0.1.2`](https://www.npmjs.com/package/semdiff) is integrated into the
differ, with its Anthropic API key stored in an SSM `SecureString` (ADR-0024)
and the differ kept strictly async, never publicly invokable (ADR-0007). The
**change-history** page surfaces a real substantive diff — the EU Omnibus
(Directive 2026/470) narrowing CSRD scope to a €450M-turnover / 1,000-employee
threshold — and the differ's LLM spend is guarded by the content-hash gate, a
per-diff change-set cap, a fail-fast timeout, and no async retries (ADR-0016).

**Web**: the React + TypeScript app in [`web/`](web/)
([ADR-0013](adr/0013-static-generation-thin-api.md),
[ADR-0021](adr/0021-react-typescript-webpack-web-app.md)): React components
rendered from the `core` corpus, **prerendered to static HTML** with webpack so
pages stay indexable and Always-Free to host, then **hydrated as islands** over
the live API. It ships a landing page, a regimes index, a page per obligation
(status, applicability criteria, first reporting deadline, and a **live
grounding badge** that reflects the real `obligation_groundings` table), a
**tracked-sources** page, a **change-history** (diffs) page, and the two
flagship interactive features: a **Scope Checker** that runs the applicability
engine in the browser, and an **as-of-date slider** that runs the bitemporal
resolver to show how a status reads on a chosen valid date versus a chosen
knowledge date (with per-row grounding provenance). It also carries two
reference pages, a **status-states explainer** (ADR-0006) and a **methodology**
page (ADR-0002, ADR-0004), plus dark mode
([ADR-0029](adr/0029-dark-mode-theming.md)) on a token-driven design system
([ADR-0030](adr/0030-token-driven-design-system.md)). View-model, scope-check,
timeline, and grounding-overlay logic are pure and held to the same per-file
coverage gate; the webpack config and the client/prerender entry points are glue.

The pipeline, the persisted bitemporal corpus, the corpus-backed API, and
obligation grounding are all live. The thin API serves `/api/sources`,
`/api/diff`, `/api/scope-check`, `/api/as-of`, and `/api/grounding`, and the web
app reads it directly (with a least-privilege, read-only DSQL role,
[ADR-0025](adr/0025-least-privilege-database-roles.md), and CDK-managed site
deployment, [ADR-0026](adr/0026-cdk-managed-web-deployment.md)). What's next:
more source adapters ([ADR-0008](adr/0008-authoritative-source-ingestion.md))
beyond the seeded set, span-level grounding (ADR-0028 §4), and ISSB once an IFRS
licence is in place ([ADR-0027](adr/0027-issb-deferred-pending-ifrs-licensing.md)).

```sh
npm test                            # unit tests + per-file coverage gate
npm run typecheck                   # tsc over core + infra + web
npm run synth -w @sust-reg/infra    # synthesize the CloudFormation templates
npm run build:web                   # prerender the site + bundle into web/dist/
```

## v1 scope

Three high-churn, well-documented regimes, and no more
([ADR-0009](adr/0009-v1-scope-three-regimes.md)):

- **California SB 253 and SB 261**
- **EU CSRD** (post-Omnibus, both waves)
- **ISSB S1 and S2**, *deferred from v1* pending an IFRS licence to store and
  serve the standards text ([ADR-0027](adr/0027-issb-deferred-pending-ifrs-licensing.md)).

This is enough to prove the bitemporal model, the diff engine, and the
applicability logic without drowning in global coverage. SB 261 (law on the
books while enforcement was stayed) is the canonical bitemporal showcase, and is
live: it resolves to `stayed` as known in 2025 but `in-effect` as known in 2024.

## Core design principles

- **Primary-source pinned, not interpretive.** Return source text, citations,
  effective dates, and applicability. Do not advise.
  ([ADR-0002](adr/0002-primary-source-non-interpretive-scope.md))
- **Bitemporal data model.** Two time axes, *valid time* (when a rule was
  actually in effect) and *transaction time* (when we recorded it), so the
  system can answer both "what was in effect on date D" and "what did we
  believe was in effect as of our ingestion on D."
  ([ADR-0003](adr/0003-bitemporal-data-model.md))
- **Citation integrity.** Every answer pins to an exact source span, version,
  and retrieval date. This is the anti-hallucination architecture and is
  non-negotiable. ([ADR-0004](adr/0004-citation-integrity.md))
- **Applicability engine.** Given a company profile (revenue, jurisdictions,
  listing status, fiscal year end), determine which obligations apply and by
  when. This is conditional logic, not lookup, the highest-value, hardest
  piece. ([ADR-0005](adr/0005-applicability-engine.md))
- **Explicit status states.** A regulation can be *proposed*, *in-effect*,
  *enforced*, or *stayed*. SB 261, for instance, has been law while enforcement
  was paused pending appeal. A naive tool gets this catastrophically wrong.
  ([ADR-0006](adr/0006-explicit-regulation-status-states.md))
- **Change detection and diffing.** Structured, meaning-aware diffs (via
  `semdiff`) when a source changes, the recurring-value engine.
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
- **S3** holds raw immutable snapshots keyed by content hash, identical
  content is never stored twice, every version is preserved.
  ([ADR-0011](adr/0011-content-addressed-snapshot-store.md))
- **Aurora DSQL** holds the queryable bitemporal corpus, metadata index, and
  applicability data. ([ADR-0012](adr/0012-aurora-dsql-data-store.md))
- **Lambda (differ)** runs `semdiff` **only when the content hash changed**,
  gating the costly, external, nondeterministic LLM calls.
  ([ADR-0007](adr/0007-change-detection-via-semdiff.md))

### Serving

The website is the primary human surface, demoable, indexable, usable by
non-developers. Most pages are **statically generated** from the database so
reads don't burn function invocations. A **thin API** is reserved for the three
interactive features that surface the engineering depth
([ADR-0013](adr/0013-static-generation-thin-api.md)):

- an **as-of-date slider** that resolves status across both time axes,
- a **scope checker** that runs the applicability engine on a company profile,
- a **diff view** of meaning-aware changes between source versions.

The API is served by an **API Gateway HTTP API behind CloudFront**: the Lambda
is never publicly exposed and the endpoint is throttled
([ADR-0023](adr/0023-api-gateway-http-api.md), which superseded the original
Lambda Function URL approach in
[ADR-0014](adr/0014-lambda-function-urls-over-api-gateway.md) after the
CloudFront-to-Function-URL OAC path proved unreliable).

### Infrastructure

All infrastructure is **AWS CDK** in [`infra/`](infra/)
([ADR-0015](adr/0015-cdk-for-infrastructure.md)).

## Data store

**Aurora DSQL**: PostgreSQL-compatible, AWS-native, serverless, scales to
zero, with an ongoing Always-Free tier (100,000 DPUs + 1 GiB/month). The two
core access patterns (point-in-time bitemporal lookup and conditional
applicability) are relational by nature; applicability reads naturally as a SQL
`WHERE` clause. ([ADR-0012](adr/0012-aurora-dsql-data-store.md))

DSQL is PostgreSQL-*compatible*, not full Postgres; the limits we hit live are
listed under [Open questions](#open-questions), and non-overlapping valid periods
are kept in application code rather than a GiST exclusion constraint (ADR-0022).
On Lambda, connect **per invocation** over the HTTP/TLS endpoint rather than
pooling raw TCP, or connection exhaustion bites under burst (ADR-0012).

## Cost discipline

The project is meant to live **indefinitely**, so it is architected strictly
inside AWS **Always Free** ([ADR-0016](adr/0016-aws-always-free-cost-discipline.md)).

- **Set a budget alarm on day one at a $1 threshold.** Non-negotiable.
- **Avoid a NAT Gateway** (~$33/mo just to exist), keep Lambda out of any VPC
  that needs one.
- **Set CloudWatch Logs retention (7–14 days)** or logs bill silently.
- **Stay in a single region.**
- If using a new AWS account, choose the **Paid Plan** (not the six-month Free
  Plan) and stay inside Always Free. A pre-July-2025 personal account is
  preferable for indefinite free hosting.

## Reliability is the contribution

An LLM in a loop is nondeterministic, costs per call, and is wrong some
percentage of the time. The unglamorous engineering (schema validation,
retries, idempotency, caching, confidence flags, an eval harness, graceful
failure) is the actual contribution. The product
is scoped to where **~90–95% correctness with human review beats the status
quo**; nothing here is built to silently need four-nines accuracy.
([ADR-0017](adr/0017-reliability-and-quality-layer.md))

## Architecture Decision Records

The full rationale lives in [`adr/`](adr/). Start with the
[index](adr/README.md).

## Open questions

- Aurora DSQL is PostgreSQL-*compatible*, not full Postgres, and its limits were
  confirmed live: no `jsonb` (JSON is stored as `text`), no sequences/`SERIAL`
  (uuid + `gen_random_uuid()`), foreign keys are not enforced (integrity is kept
  in application code), and `GRANT USAGE ON SCHEMA public` is rejected. pgvector
  for semantic citation search is still unverified.

## Build order

1. ✅ **`semdiff`**: the meaning-aware diff engine, published as
   [`semdiff@0.1.2`](https://www.npmjs.com/package/semdiff) and integrated here.
2. ✅ **`core` domain logic**: status states, applicability engine, and the
   bitemporal resolver, with seed data and a per-file-gated test suite.
3. ✅ **Infrastructure**: all six CDK stacks deployed (cost backstop, data
   store + DSQL, pipeline, serving, DNS, and the us-east-1 certificate).
4. ✅ **Web app**: prerendered static site with a client-side Scope Checker and
   as-of slider.
5. ✅ **Pipeline connective tissue**: source adapters, the ingestor's S3 write,
   and the differ's S3-read + DSQL persist of diffs, verified end to end.
6. ✅ **Corpus-backed API**: the thin API serves the stored corpus and the web
   app reads the live `/api`, via a least-privilege read-only DSQL role (ADR-0025).
7. ✅ **Obligation grounding**: append-only grounding facts (ADR-0028) link each
   obligation to its ingested snapshot; the API and web surface the grounded vs.
   ungrounded distinction.
8. ✅ **Custom domain**: [disclosurelab.dev](https://disclosurelab.dev) — Route 53
   DNS (registered at Vercel, delegated to Route 53), a us-east-1 ACM cert, and
   CloudFront aliases with a `www`→apex redirect (ADR-0031, ADR-0032).
9. ⬜ **Next**: more source adapters (ADR-0008), span-level grounding
   (ADR-0028 §4), and ISSB once an IFRS licence is in place (ADR-0027).

## License

[MIT](LICENSE) © 2026 Brian Benzinger
