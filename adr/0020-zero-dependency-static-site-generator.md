# 0020 — Zero-dependency TypeScript static site generator for the web

- **Status:** Superseded by [ADR-0021](0021-react-typescript-webpack-web-app.md)
- **Date:** 2026-05-31

> **Superseded.** The web workspace adopted React + TypeScript + webpack
> ([ADR-0021](0021-react-typescript-webpack-web-app.md)) to support richer
> client-side interactivity (the Scope Checker and the other ADR-0013 features).
> The intent preserved here — prerendered, indexable, Always-Free-hosted static
> output (ADR-0013, ADR-0016) — carries over; only the "no build tooling / no
> dependencies" mechanism is replaced.

## Context

[ADR-0013](0013-static-generation-thin-api.md) decided *that* the website is
statically generated, with a thin API reserved for three interactive features.
It did not pick *how* the static pages are produced. The web workspace now
needs a concrete generator.

The forces in play are specific to this project:

- The corpus is small and structured (it comes from `@sust-reg/core`, ADR-0018),
  and the site must be indexable and usable by non-developers (ADR-0013).
- The output must be plain static files servable from the content store behind
  CloudFront, inside AWS Always Free (ADR-0014, ADR-0016).
- The repo's stated ethos is minimal dependencies: `core` carries **no runtime
  dependencies**, and the toolchain runs on Node's native TypeScript
  type-stripping. The contribution is the reliability/quality layer, gated by a
  per-file coverage bar (ADR-0017, ADR-0019), not framework breadth.

A full meta-framework (Next.js, Astro) would bring a large dependency tree, a
build toolchain, and a learning/maintenance surface that dwarfs the few pages
actually being generated.

## Decision

Generate the site with a **small, dependency-free TypeScript static site
generator** that lives in the `web` workspace and consumes `@sust-reg/core`
directly. The same conventions the rest of the repo uses carry over:

- **Pure, testable rendering.** `web/src/` holds the view-model derivation
  (`model.ts`), HTML rendering (`render.ts`), assets (`assets.ts`), and page
  assembly (`site.ts`). These are pure functions that return strings/in-memory
  file lists and perform no I/O, so they fall under the per-file coverage gate
  (ADR-0019).
- **I/O glue is a thin entrypoint.** `web/bin/build.ts` flushes the in-memory
  file list to `web/dist/`. Like the CDK app entrypoint in `infra/bin/`, it is
  excluded from the coverage gate because it is glue, not logic.
- **No runtime/build dependencies.** The only `dependencies` entry is the
  workspace's own `@sust-reg/core`. The build runs under Node's native
  type-stripping (`node bin/build.ts`), consistent with the rest of the repo.
- **Output is plain static files** (HTML + one stylesheet), uploadable as-is to
  the content store behind CloudFront. Internal links are root-relative to
  explicit `.html` files so they resolve on a plain static host without rewrite
  rules.

The non-interpretive posture (ADR-0002) and citation grounding (ADR-0004) are
first-class in the output: the "not legal advice" notice renders on every page,
and each obligation surfaces an explicit grounded/ungrounded badge so seed data
is visibly distinguishable from grounded fact.

## Consequences

- The web workspace stays aligned with `core`'s zero-runtime-dependency
  discipline; there is no framework to track for CVEs or major-version churn.
- Page logic is unit-tested behind the same 95/90 per-file gate as the rest of
  the codebase, rather than trusted to a framework's renderer.
- We hand-roll conveniences a framework would provide (routing, asset
  pipelines, dev server, incremental builds). This is acceptable at v1's page
  count but is the main thing to revisit if the site grows substantially or if
  the thin interactive API (ADR-0013) needs client-side hydration.
- The build is a pure function of the corpus, so output is deterministic and
  can be regenerated whenever ingestion records a change (ADR-0013).

## Alternatives considered

- **Next.js static export.** Rejected for v1: a large dependency tree and build
  toolchain far heavier than the handful of generated pages warrant, and at
  odds with the repo's minimal-dependency ethos.
- **Astro.** A strong content-site fit with island hydration for the future
  interactive features, but still a substantial dependency and toolchain for
  the current page count. Reconsider if/when client-side interactivity for the
  slider, scope checker, or diff view (ADR-0013) outgrows a hand-rolled
  approach.
- **Eleventy or another templating SSG.** Rejected: adds a dependency and a
  templating language while giving up the type-safety and direct reuse of
  `@sust-reg/core` types that plain TypeScript provides.
