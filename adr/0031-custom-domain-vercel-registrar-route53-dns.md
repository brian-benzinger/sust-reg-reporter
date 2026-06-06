# 0031 — Custom domain: Vercel registrar, Route 53 DNS

- **Status:** Accepted
- **Date:** 2026-06-06

## Context

The live site is served from CloudFront (ADR-0013, ADR-0023) on its generated
`*.cloudfront.net` URL. We want a memorable custom domain. `disclosurelab.dev`
was chosen (`disclosurelab.com` was taken; `.dev` is on the HSTS preload list,
which only forces HTTPS — already true for us via CloudFront + ACM).

Two facts shape the design:

1. **Renewal tracking.** The owner already manages other domains at **Vercel**
   and wants every renewal in one dashboard/bill, so surprise auto-renew charges
   don't arrive from a second registrar.
2. **Apex on CloudFront.** The site needs the **apex** (`disclosurelab.dev`,
   no `www`) to resolve to CloudFront, plus an **ACM certificate validated by
   DNS**. DNS forbids a `CNAME` at the apex; Route 53 **alias** records solve
   this cleanly, and Route 53 makes ACM DNS-validation trivial. Vercel DNS does
   not do alias-to-arbitrary-CloudFront at the apex cleanly.

A domain's **registrar** (who bills the renewal) and its **authoritative DNS
host** (who answers lookups) are independent — the link is the nameserver (NS)
delegation set at the registrar.

## Decision

**Split the two roles:** register at Vercel, host DNS at Route 53.

- **Registrar / renewals: Vercel.** One dashboard, one bill (satisfies the
  tracking goal).
- **Authoritative DNS: a Route 53 public hosted zone**, with Vercel's domain
  nameservers pointed at the zone's four NS to delegate.
- The zone is created and owned by its own CDK stack, **`SustReg-Dns`**
  (`DnsStack`), with `RemovalPolicy.RETAIN`. It is foundational and rarely
  touched; the volatile records inside it (ACM validation CNAME, the CloudFront
  apex alias) are added by sibling stacks that **reference the zone by id**, so
  the zone container is never at the mercy of an app stack's deploy lifecycle.
- A throwaway zone was created by hand during setup to check the registrar flow,
  but was **deleted before any delegation**; CDK then created the single
  canonical zone via `cdk deploy`. Because the nameservers had not yet been
  pasted into Vercel, letting CDK own a fresh zone cost nothing — there was no
  live delegation to preserve, so no `cdk import` was needed.
- **DNSSEC is left off.** `.dev` doesn't require it, and enabling it would mean
  coordinating DS records between Vercel and Route 53 for no benefit here.

## Consequences

- Renewals stay entirely at Vercel — the original goal — while DNS gets Route
  53's clean apex-alias + ACM DNS-validation integration.
- A Route 53 hosted zone costs **$0.50/mo**, the one deliberate, surfaced
  exception to the Always-Free posture (ADR-0016); it is well inside the $1
  budget alarm and is not "click-ops" — it's codified here in CDK.
- The CloudFront ACM certificate must live in **us-east-1**, which conflicts with
  the single-region `us-west-2` guard (ADR-0016 / `SingleRegionAspect`). The
  follow-up cert/alias work must handle the cross-region cert explicitly (e.g. a
  dedicated us-east-1 certificate stack); this ADR covers only the hosted zone.
- RETAIN + a standalone stack means a `cdk destroy` of compute can never rotate
  the nameservers and silently break the registrar delegation.
- CDK owns the zone from creation, so there is no drift between code and the live
  zone and no out-of-band resource to reconcile.

## Alternatives considered

- **Register at Route 53 too (one provider for domain + DNS).** Rejected: adds a
  *second* registrar to track renewals at, the exact pain the owner wanted to
  avoid.
- **Use Vercel DNS (add records at Vercel, skip Route 53).** Rejected: the apex
  can't `CNAME` to CloudFront, and Vercel DNS doesn't do alias-to-arbitrary-
  CloudFront at the apex; we'd also lose Route 53's clean ACM DNS validation.
- **Adopt the throwaway manual zone via `cdk import` instead of recreating.**
  Rejected: with no nameservers delegated yet there was nothing to preserve, so a
  clean CDK-created zone is simpler. `cdk import` also collides with a
  CloudFormation limitation — an import changeset cannot add stack `Tags` or a
  `RoleArn`, both of which this app sets — making it the harder path for no gain
  here. (Import would be the right tool if the NS were already live.)
- **Keep the zone outside CDK (CLI only), reference it by id from app stacks.**
  Reasonable and safe, but the owner wants full IaC; a CDK-owned zone with RETAIN
  gives IaC ownership *and* the nameserver-stability safety.
