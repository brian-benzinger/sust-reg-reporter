# 0013 — Static generation with a thin interactive API

- **Status:** Accepted
- **Date:** 2026-05-30

## Context

The website is the primary human surface: it must be demoable, indexable by
search engines, and usable by non-developers. Most content (the corpus, version
history, citations) is read-heavy and changes only when ingestion records a
change. Serving every read through a function invocation would burn the
Always-Free Lambda budget needlessly
([ADR-0016](0016-aws-always-free-cost-discipline.md)). A thin API wrapper, on
its own, is also trivially cloned — durable value is in the orchestration and
the interactive depth, not a generic CRUD surface.

## Decision

**Statically generate most pages** from the database at build or revalidation
time, so reads do not burn function invocations. Reserve a **thin API** only for
the interactive features that genuinely need live computation:

- an **as-of-date slider** — the bitemporal model
  ([ADR-0003](0003-bitemporal-data-model.md)) made visible,
- a **scope checker** — the applicability engine
  ([ADR-0005](0005-applicability-engine.md)) made visible,
- a **diff view** — change detection
  ([ADR-0007](0007-change-detection-via-semdiff.md)) made visible.

These three features are the engineering depth surfaced, not decoration.

## Consequences

- Reads are cheap and fast (static, CDN-served); the API is invoked only for
  genuinely dynamic interactions.
- Static pages are indexable and demoable, serving the non-developer audience.
- The API is intentionally small, which keeps it inside the Always-Free Lambda
  envelope and behind CloudFront
  ([ADR-0014](0014-lambda-function-urls-over-api-gateway.md)).
- Static content must be regenerated/revalidated when ingestion records a
  change, tying the build to the pipeline's change signal.

## Alternatives considered

- **Fully dynamic, server-rendered-per-request site.** Rejected: burns function
  invocations on read-heavy content that rarely changes.
- **Pure SPA hitting the API for everything.** Rejected: poor indexability/SEO
  and more API load; the corpus is better pre-rendered.
- **A fat general-purpose API.** Rejected: a thin API wrapper gets cloned in a
  weekend; value lives in the corpus, orchestration, and the three interactive
  features.
