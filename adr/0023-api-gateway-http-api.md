# 0023 — API Gateway HTTP API for the thin API

- **Status:** Accepted (supersedes [ADR-0014](0014-lambda-function-urls-over-api-gateway.md))
- **Date:** 2026-05-31

## Context

[ADR-0014](0014-lambda-function-urls-over-api-gateway.md) put the thin API
([ADR-0013](0013-static-generation-thin-api.md)) behind a **Lambda Function URL**
fronted by CloudFront, rejecting API Gateway purely on cost: API Gateway's free
allowance is the legacy 12-month tier, gone for new accounts.

Two things changed that calculus:

1. **Security posture.** A Function URL puts the Lambda on a public URL.
   Restricting it to CloudFront requires CloudFront Origin Access Control (OAC)
   SigV4 signing to the Function URL — which proved brittle in practice
   (persistent 403s despite a config matching AWS's documented recipe). The
   alternative, a public (`authType: NONE`) Function URL, exposes the Lambda
   directly with no throttling — an unbounded abuse/cost surface.
2. **Actual cost.** The deploying account is old; its 12-month tier is long
   expired, so API Gateway is not free here. But **HTTP API is ~$1.00 per
   million requests** — at this project's volume (thousands of requests/month)
   that is a fraction of a cent, comfortably inside the $1 budget alarm
   ([ADR-0016](0016-aws-always-free-cost-discipline.md)).

## Decision

Serve the thin API via an **API Gateway HTTP API** integrated to the API Lambda,
fronted by the same CloudFront distribution (`/api/*` behavior) as the static
site. The **Lambda has no public Function URL** — only API Gateway may invoke
it. The HTTP API's default stage carries a **throttle** (rate + burst limits) so
the public endpoint cannot run up cost.

HTTP API (not REST API): REST API is ~$3.50 per million and adds features we do
not need.

## Consequences

- The Lambda is never publicly exposed; the public surface is a managed,
  throttled API Gateway endpoint — the safety the Function URL lacked.
- Reliable: no CloudFront-OAC-to-Function-URL SigV4 signing to get wrong.
- API Gateway is **billable, not Always-Free**, so this is a deliberate, small
  exception to [ADR-0016](0016-aws-always-free-cost-discipline.md): at our volume
  it is pennies/month, bounded by the throttle and backed by the $1 budget alarm.
- The cost-guardrail aspect is relaxed to permit `AWS::ApiGatewayV2::Api` (HTTP
  API) while still forbidding the pricier `AWS::ApiGateway::RestApi`, plus NAT
  Gateways and ALBs. ADR-0014 is superseded; the no-ALB / no-NAT posture stands.

## Alternatives considered

- **Lambda Function URL + CloudFront OAC (ADR-0014).** Superseded: the OAC SigV4
  path to a Function URL was unreliable in practice, and a public Function URL
  has no throttling.
- **REST API.** Rejected: ~3.5x the cost of HTTP API for features we do not need.
- **Public Function URL with no auth.** Rejected: exposes the Lambda directly
  with no throttle — an unbounded abuse/cost surface.
