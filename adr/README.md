# Architecture Decision Records

This directory holds the Architecture Decision Records (ADRs) for the
**Sustainability Regulation Tracker**. Each record captures a single
significant decision: its context, the options considered, the choice made,
and the consequences that follow.

The records are derived from the founding project brief. They are the
durable, reviewable rationale behind the system — the "why," kept separate
from the "how" that lives in code and the "what" that lives in the README.

## Format

Records follow a lightweight [MADR](https://adr.github.io/madr/)-style
template:

- **Status** — proposed / accepted / superseded / deprecated
- **Context** — the forces and constraints in play
- **Decision** — what we chose
- **Consequences** — what becomes easier, harder, or risky
- **Alternatives considered** — what we rejected and why

Records are immutable once accepted. To change a decision, write a new ADR
that supersedes the old one and update the status of both. This preserves the
historical reasoning — which is, fittingly, the same bitemporal discipline the
product itself is built on.

## Index

| ADR | Title | Status |
| --- | --- | --- |
| [0000](0000-record-architecture-decisions.md) | Record architecture decisions | Accepted |
| [0001](0001-two-repo-structure.md) | Two-repo structure: semdiff engine + reporter monorepo | Accepted |
| [0002](0002-primary-source-non-interpretive-scope.md) | Primary-source pinned, non-interpretive product scope | Accepted |
| [0003](0003-bitemporal-data-model.md) | Bitemporal data model (valid time + transaction time) | Accepted |
| [0004](0004-citation-integrity.md) | Citation integrity as anti-hallucination architecture | Accepted |
| [0005](0005-applicability-engine.md) | Applicability engine for per-company obligations | Accepted |
| [0006](0006-explicit-regulation-status-states.md) | Model regulation status states explicitly | Accepted |
| [0007](0007-change-detection-via-semdiff.md) | Change detection and diffing gated through semdiff | Accepted |
| [0008](0008-authoritative-source-ingestion.md) | Authoritative-source ingestion over HTML scraping | Accepted |
| [0009](0009-v1-scope-three-regimes.md) | v1 scope: three high-churn regimes only | Accepted (ISSB scope superseded by 0027) |
| [0010](0010-serverless-snapshotting-pipeline.md) | Serverless snapshotting pipeline on AWS | Accepted |
| [0011](0011-content-addressed-snapshot-store.md) | Content-addressed S3 snapshot store | Accepted |
| [0012](0012-aurora-dsql-data-store.md) | Aurora DSQL as the primary data store | Accepted |
| [0013](0013-static-generation-thin-api.md) | Static generation with a thin interactive API | Accepted |
| [0014](0014-lambda-function-urls-over-api-gateway.md) | Lambda Function URLs behind CloudFront over API Gateway | Superseded by 0023 |
| [0015](0015-cdk-for-infrastructure.md) | CDK for infrastructure as code | Accepted |
| [0016](0016-aws-always-free-cost-discipline.md) | AWS Always-Free architecture and cost discipline | Accepted |
| [0017](0017-reliability-and-quality-layer.md) | Reliability and quality layer as the core contribution | Accepted |
| [0018](0018-shared-core-domain-workspace.md) | Shared `core` workspace for cross-cutting domain logic | Accepted (test tooling superseded by 0019) |
| [0019](0019-vitest-testing-and-coverage.md) | Vitest for testing and per-file coverage enforcement | Accepted |
| [0020](0020-zero-dependency-static-site-generator.md) | Zero-dependency TypeScript static site generator for the web | Superseded by 0021 |
| [0021](0021-react-typescript-webpack-web-app.md) | React + TypeScript + webpack for the web application | Accepted |
| [0022](0022-in-code-bitemporal-representation.md) | In-code bitemporal representation and as-of resolution | Accepted |
| [0023](0023-api-gateway-http-api.md) | API Gateway HTTP API for the thin API | Accepted |
| [0024](0024-ssm-securestring-secrets.md) | SSM Parameter Store SecureString for app secrets | Accepted |
| [0025](0025-least-privilege-database-roles.md) | Least-privilege database roles for the serving path | Accepted |
| [0026](0026-cdk-managed-web-deployment.md) | CDK-managed web deployment via BucketDeployment | Accepted |
| [0027](0027-issb-deferred-pending-ifrs-licensing.md) | ISSB deferred from the v1 corpus pending an IFRS Sustainability licence | Accepted |
| [0028](0028-ground-obligations-via-append-only-grounding-facts.md) | Ground obligations to ingested snapshots via append-only grounding facts | Accepted |
| [0029](0029-dark-mode-theming.md) | Dark mode via CSS-variable themes and an inline pre-paint script | Accepted (amends 0021) |
| [0030](0030-token-driven-design-system.md) | A token-driven design system, not an external UI framework | Accepted (amends 0021) |
