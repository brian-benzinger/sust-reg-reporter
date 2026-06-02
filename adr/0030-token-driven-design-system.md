# 0030 — A token-driven design system, not an external UI framework

- **Status:** Accepted (amends [ADR-0021](0021-react-typescript-webpack-web-app.md),
  builds on [ADR-0029](0029-dark-mode-theming.md))
- **Date:** 2026-06-02

## Context

The web app is the primary human surface and has to be credible to
non-developers ([ADR-0013](0013-static-generation-thin-api.md)). The first
cut was functional but visually plain — system-default type, flat boxes, a thin
palette — and read as "sad HTML." The ask was to modernize it: make it look
like a contemporary product and "pop a little more."

The instinct is to reach for a CSS framework (Tailwind, Bootstrap) or a
component kit (MUI, shadcn). But the serving and cost contracts constrain that:

- The stylesheet is **one cacheable file** served as a static asset behind
  CloudFront, with **system fonts and no external requests**
  ([ADR-0014](0014-lambda-function-urls-over-api-gateway.md),
  [ADR-0016](0016-aws-always-free-cost-discipline.md)). A CDN-hosted framework
  or web-font import violates the no-external-request rule; a CDN can also be
  slow, blocked, or disappear.
- The architecture is **prerender + hydrated islands**, deliberately *not* a
  client-rendered SPA — that was rejected for indexability/SEO and read-heavy
  client cost ([ADR-0021](0021-react-typescript-webpack-web-app.md)). A heavy
  runtime component kit would add bundle weight to a site whose content pages
  ship **zero** JavaScript.
- [ADR-0029](0029-dark-mode-theming.md) already made **every color a CSS
  custom property** so a theme is a token override.

## Decision

Modernize the look with a **small, hand-authored design system expressed
entirely in CSS design tokens**, shipped in the existing single stylesheet
(`web/src/styles.ts`). The tokens *are* the framework.

- **Layered token set.** Beyond the ADR-0029 color variables, add structural
  tokens for radii, a soft three-step elevation/`box-shadow` scale, an easing
  curve, and a **fluid type scale** (`clamp()`) for the hero/headings/lead.
  Surfaces use a `--bg` → `--surface` → `--bg-elev` layering instead of flat
  fills.
- **Brand expression.** An emerald→cyan accent gradient drives the brand mark,
  primary button, hero accent word, and stat figures; a low-opacity radial
  "wash" sits behind the page. Status/grounding badges become tinted pills via
  `color-mix()` against the elevated surface, so they read in both themes from
  the same rule.
- **Componentry as classes, not JS.** Hero, stat row, feature-card grid, panels
  for the interactive islands, buttons, and rounded data tables are plain CSS
  classes over semantic markup. The React components stay thin shells; no new
  runtime dependency is added.
- **Motion, accessibly.** Hover lift, focus rings, and a loading spinner are
  scoped behind `prefers-reduced-motion`. A skip-link and a `<main id="main">`
  landmark improve keyboard/AT navigation.
- **Same hosting contract.** Still one stylesheet, system fonts, no external
  requests, no added bundle weight on content pages. Dark mode keeps working
  because every new surface/badge color flows through the existing tokens.

This **amends ADR-0021's styling detail** (the original "legible high-contrast
palette") with an explicit design-token system, and is the natural extension of
ADR-0029's "every color is a token."

## Consequences

- The site looks like a modern product while staying static, indexable, and
  Always-Free; the deployable artifact is unchanged (plain files, one CSS).
- New UI must keep using the tokens — a hardcoded hex would break one theme,
  and bypassing the elevation/radius tokens would drift the visual language.
- `color-mix()` and `clamp()` are relied on (broadly supported in evergreen
  browsers since 2023). The badge/notice tints degrade to their solid
  `color`/`border` if `color-mix()` is ever unavailable.
- The single-file stylesheet grows (~7 KB → ~21 KB uncompressed, trivial
  gzipped) — still one cached request, no font or framework fetch.
- Tests are unaffected: they assert markup/text, not CSS, and the asserted class
  names and copy were preserved.

## Alternatives considered

- **Tailwind / Bootstrap (CDN).** Rejected: external request violates
  ADR-0014/0016; self-hosting the build adds a toolchain and ships unused
  utility CSS for a site this small.
- **A React component kit (MUI, Chakra, shadcn).** Rejected: runtime/bundle
  weight on a prerendered, islands-only site whose content pages ship no JS
  (ADR-0021), for components a few CSS classes already cover.
- **A web-font import (Google Fonts / self-hosted).** Rejected: external request
  or an extra asset and a FOUT, against the system-font, no-external-request
  rule. The system-font stack stays.
- **Rebuild as a full client-rendered SPA.** Rejected again here for the same
  reasons as ADR-0021: it loses indexability and adds client cost. "More of an
  SPA" was met by polishing the existing islands, not discarding the prerender.
