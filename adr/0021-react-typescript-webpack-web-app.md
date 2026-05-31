# 0021 — React + TypeScript + webpack for the web application

- **Status:** Accepted (supersedes [ADR-0020](0020-zero-dependency-static-site-generator.md))
- **Date:** 2026-05-31

## Context

[ADR-0020](0020-zero-dependency-static-site-generator.md) built the web
workspace as a zero-dependency TypeScript generator that emitted HTML strings.
That kept the dependency surface minimal, but the site's reason to exist is the
three interactive features named in [ADR-0013](0013-static-generation-thin-api.md)
— the as-of-date slider, the **scope checker**, and the diff view. Those are
stateful, client-side UIs. Hand-rolling state, events, and DOM updates as raw
strings does not scale past the first feature, and re-implementing component
logic for the browser would duplicate what a component library gives for free.

The constraints that produced ADR-0020 still hold and are not negotiable:

- The site must be **indexable** and demoable to non-developers (ADR-0013).
- Hosting must stay inside **AWS Always Free** — static assets on S3 behind
  CloudFront (ADR-0014, ADR-0016).
- The **95% line / 90% branch per-file coverage gate** is the project's core
  contribution and applies to web code too (ADR-0017, ADR-0019).

## Decision

Build the web workspace as a **React + TypeScript application bundled with
webpack**, and reconcile it with the constraints above by **prerendering to
static HTML**:

- **Prerender every page to static HTML** at build time with
  `react-dom/server` (`renderToStaticMarkup`). The output is plain, indexable
  HTML uploaded to S3 — reads still don't burn function invocations (ADR-0013),
  and hosting stays Always-Free (ADR-0016). A pure page manifest (`src/site.tsx`)
  lists every page; the prerender entry is thin I/O glue.
- **Hydrate only the interactive islands.** webpack emits one client bundle
  (`app.js`) that calls `hydrateRoot` on the prerendered Scope Checker mount
  node. Static content pages ship no JavaScript.
- **Keep logic in pure, tested modules.** View-model derivation (`model.ts`)
  and the Scope Checker's parse/evaluate logic (`scope-checker.ts`) are
  DOM-free and unit-tested; React components are thin shells over them. Static
  components are tested via `renderToStaticMarkup`; the interactive component is
  tested with Testing Library under jsdom. All of `web/src` is held to the
  95/90 gate; the webpack config and the client/prerender entry points are glue
  and excluded, exactly as `infra/bin` is.
- **Reuse the shared engine.** The Scope Checker runs the same
  `@sust-reg/core` applicability engine (ADR-0005, ADR-0018) in the browser — no
  duplicated rules, and no server round-trip for a computation that is pure and
  cheap.

This **amends ADR-0013's serving detail** for the scope checker: because the
applicability engine is pure and small, the scope checker runs **client-side**
rather than behind the thin API. The as-of slider and diff view, which need the
bitemporal corpus (ADR-0003) and `semdiff` (ADR-0007) respectively, remain
candidates for the thin API.

## Consequences

- The web workspace gains runtime dependencies (`react`, `react-dom`) and a
  build toolchain (`webpack`, `ts-loader`, Testing Library, jsdom). This is the
  deliberate reversal of ADR-0020's zero-dependency stance.
- Pages stay indexable and Always-Free to host; the cost model from ADR-0013/0016
  is unchanged because the deployable artifact is still static files.
- Interactive features now have a standard, scalable component model, so the
  slider and diff view can be added without re-inventing UI plumbing.
- Build complexity rises: two webpack outputs (client + node prerender) and a
  hydration contract between prerendered HTML and the client bundle. Mismatched
  server/client initial renders would warn at hydration, so interactive
  components compute their initial view deterministically from default state.
- Dependencies must be watched for advisories and major-version churn — a cost
  ADR-0020 avoided and the main thing to weigh if the surface grows.

## Alternatives considered

- **Keep the ADR-0020 string generator and hand-roll interactivity in vanilla
  JS.** Rejected: re-implements component/state machinery for each feature and
  diverges the browser logic from the typed domain model.
- **Next.js or Astro.** Astro in particular fits prerender-plus-islands well.
  Rejected for now to keep the toolchain explicit and minimal (plain webpack +
  React) and avoid a meta-framework's conventions and upgrade cadence; this ADR
  can be revisited if the islands model outgrows a hand-configured build.
- **Pure React SPA (no prerender).** Rejected: poor indexability/SEO and more
  client work on read-heavy content — the exact failure ADR-0013 called out.
- **Serve the scope checker from the thin API instead of client-side.**
  Rejected for the engine computation: it is pure, small, and cheaper to run in
  the browser, keeping invocations down (ADR-0016). The API remains the right
  home for features that need server-side data (slider, diff).
