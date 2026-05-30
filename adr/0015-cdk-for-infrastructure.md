# 0015 — CDK for infrastructure as code

- **Status:** Accepted
- **Date:** 2026-05-30

## Context

The system is entirely AWS-serverless (EventBridge, Lambda, S3, Aurora DSQL,
CloudFront — see [ADR-0010](0010-serverless-snapshotting-pipeline.md)). It must
be reproducible, reviewable, and version-tracked like the rest of the project.
The infrastructure definition is itself a portfolio artifact.

## Decision

Define all infrastructure with **AWS CDK**, living in the `infra` workspace of
the `sust-reg-reporter` monorepo ([ADR-0001](0001-two-repo-structure.md)).

## Consequences

- CDK is the idiomatic AWS-native IaC choice and is a credible artifact on its
  own; it shares the language/tooling of the rest of the TypeScript monorepo.
- Infrastructure lives in-repo and is reviewed alongside application changes,
  keeping the deployable system coherent in a single version line.
- Cost-discipline guardrails ([ADR-0016](0016-aws-always-free-cost-discipline.md))
  — the $1 budget alarm, CloudWatch Logs retention, single-region, no NAT
  Gateway — are codified in CDK rather than clicked in the console, so they
  cannot silently drift.

## Alternatives considered

- **Terraform.** Viable and popular, but CDK is more idiomatic for an
  all-AWS, TypeScript-centric stack and keeps one language across the repo.
- **Raw CloudFormation / SAM.** Rejected: more verbose and less expressive than
  CDK for the same target.
- **Console click-ops.** Rejected: not reproducible, not reviewable, and lets
  cost guardrails drift.
