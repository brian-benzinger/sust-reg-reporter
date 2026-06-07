# 0032 — CloudFront certificate in us-east-1 via a dedicated stack

- **Status:** Accepted
- **Date:** 2026-06-06

## Context

ADR-0031 delegates DNS for the custom domain (`disclosurelab.dev`) to a Route 53
hosted zone so the site can be served over HTTPS on the apex (+ `www`) through
the existing CloudFront distribution (ADR-0013, ADR-0023). That requires an ACM
certificate attached to the distribution.

Two constraints collide:

1. **CloudFront only accepts ACM certificates in `us-east-1`**, regardless of
   where the distribution's stack lives. Our stacks are single-region
   `us-west-2` (ADR-0016), and `SingleRegionAspect` *fails synth* for any stack
   in another region.
2. The serving stack (`SustReg-Serving`) — which owns the distribution — is in
   `us-west-2` and cannot itself hold a `us-east-1` certificate.

## Decision

Issue the certificate from a **dedicated `us-east-1` stack, `SustReg-CertUsEast1`
(`CertStack`)**, and let the serving stack consume it cross-region.

- The cert covers the apex and `www`, **DNS-validated** against the Route 53 zone
  (ADR-0031). The validation options carry the hosted zone id, so CloudFormation
  creates and later removes the validation records itself — no custom resource.
- `SingleRegionAspect` gains a **narrow exemption list**: a named stack may sit
  in **exactly `us-east-1`** and nowhere else. Only `SustReg-CertUsEast1` is
  listed. Every other stack — and any other region, even for the exempted stack
  — still fails the guard. This keeps the single-region invariant meaningful
  while admitting the one unavoidable exception.
- The hosted zone is referenced **by id** (`HOSTED_ZONE_ID`, the RETAINed zone
  from ADR-0031), so the cert stack does not re-create or depend on the zone's
  CDK construct across regions.
- The issued certificate is exported and attached to the CloudFront distribution
  by the serving stack via a **cross-region reference** (a separate, following
  change).

## Consequences

- HTTPS on the custom domain becomes possible without relaxing the single-region
  guard for anything else; the exemption is explicit, named, and region-pinned.
- The account must be **CDK-bootstrapped in `us-east-1`** (one-time) in addition
  to `us-west-2`. The bootstrap resources (empty S3 staging bucket, ECR repo)
  cost effectively nothing (ADR-0016).
- ACM certificates renew automatically as long as the DNS validation records
  remain in the zone; keeping the zone RETAINed (ADR-0031) keeps renewal working.
- A cross-region reference (next change) introduces a CDK-managed reader for the
  cert ARN; it runs only at deploy time and is the standard mechanism for sharing
  a `us-east-1` cert with a non-`us-east-1` CloudFront stack.

## Alternatives considered

- **`DnsValidatedCertificate` with `region: 'us-east-1'` inside the serving
  stack.** Rejected: it is deprecated (slated for removal) and relies on a custom
  resource; a native `acm.Certificate` in a real `us-east-1` stack is the
  supported, future-proof path.
- **Move the whole serving stack (CloudFront, bucket, API) to `us-east-1`.**
  Rejected: a large, unrelated migration of stateful/serving resources purely to
  satisfy the cert's region; the dedicated cert stack is far smaller in blast
  radius.
- **Weaken `SingleRegionAspect` to allow `us-east-1` generally.** Rejected: that
  would silently permit *any* stack to drift to `us-east-1`. A named,
  single-stack, region-pinned exemption preserves the guard's intent.
