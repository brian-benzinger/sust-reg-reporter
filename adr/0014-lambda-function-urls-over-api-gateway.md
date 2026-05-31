# 0014 — Lambda Function URLs behind CloudFront over API Gateway

- **Status:** Superseded by [ADR-0023](0023-api-gateway-http-api.md)
- **Date:** 2026-05-30

## Context

The thin interactive API ([ADR-0013](0013-static-generation-thin-api.md)) needs
an HTTP entry point. The two natural AWS options are API Gateway and Lambda
Function URLs. Free-tier economics matter for an indefinitely-running project
([ADR-0016](0016-aws-always-free-cost-discipline.md)): **CloudFront egress is
Always Free (1 TB + 10M requests), whereas API Gateway's free allowance is the
legacy 12-month model** that is gone for new accounts.

## Decision

Expose the API via **Lambda Function URLs behind CloudFront**, rather than API
Gateway.

## Consequences

- Requests ride CloudFront's ongoing free egress instead of API Gateway's
  expired-for-new-accounts free tier.
- CloudFront already fronts the statically generated site, so a single CDN
  distribution serves both static pages and the thin API — fewer moving parts.
- We forgo API Gateway's built-in features (usage plans, request validation,
  API keys). For a thin, mostly-public, read-oriented API this is acceptable;
  validation lives in the Lambda handlers
  ([ADR-0017](0017-reliability-and-quality-layer.md)).

## Alternatives considered

- **API Gateway (REST/HTTP API).** Rejected primarily on cost: its free
  allowance is legacy 12-month only and does not apply to new accounts; its
  extra features are not needed for this thin API.
- **ALB in front of Lambda.** Rejected: an ALB carries an hourly charge and
  does not fit the scale-to-zero, Always-Free posture.
