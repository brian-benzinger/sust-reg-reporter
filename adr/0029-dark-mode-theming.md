# 0029 — Dark mode via CSS-variable themes and an inline pre-paint script

- **Status:** Accepted (amends [ADR-0021](0021-react-typescript-webpack-web-app.md))
- **Date:** 2026-06-02

## Context

The web app is the primary human surface. It is prerendered to static HTML with
only the three interactive features hydrating as islands; **static content pages
ship no JavaScript** ([ADR-0013](0013-static-generation-thin-api.md),
[ADR-0021](0021-react-typescript-webpack-web-app.md)). The stylesheet is a
single cacheable file with all colors already expressed as CSS custom properties
([ADR-0014](0014-lambda-function-urls-over-api-gateway.md)), system fonts only,
and no external requests.

A dark mode has to satisfy three things at once: (1) respect the visitor's OS
preference by default and let them override it persistently; (2) work on **every**
page, including the content pages that never load `app.js`; and (3) never flash
the wrong theme on load. A React-island toggle wired through the hydration bundle
fails (2) — those pages have no bundle — and a toggle that only flips a class
after hydration fails (3).

## Decision

Ship theming as **CSS-variable token sets plus a tiny inline `<head>` script**,
not as a hydrated island.

- **Tokens, not new colors.** Because every color already flows through a CSS
  variable, dark mode is a token override: `:root[data-theme="dark"] { … }`
  redefines the palette (tracking GitHub's dark scale for AA contrast) and sets
  `color-scheme: dark` so native controls and scrollbars follow. Light stays the
  `:root` default. An `@media (prefers-color-scheme: dark)` block on
  `:root:not([data-theme])` gives no-JS visitors their OS theme.
- **Inline pre-paint script.** Layout injects a small, dependency-free snippet
  (`web/src/theme.ts` → `THEME_INIT_SCRIPT`) into every document `<head>`. It
  reads the stored preference (or `system`), resolves it against
  `prefers-color-scheme`, and sets `data-theme` on `<html>` **before first
  paint** — no flash. It also wires the toggle via **click delegation on
  `document`**, so one handler controls the button on every prerendered page,
  and re-resolves on OS change while the preference is `system`.
- **Static toggle button.** The header toggle (`ThemeToggle`) is plain
  prerendered markup carrying all three glyphs (System / Light / Dark); CSS
  reveals the one matching the `data-theme-pref` attribute the script sets. It
  needs no per-page JavaScript of its own.
- **Preference model.** Three states — `system` (default), `light`, `dark` —
  cycled by the toggle and persisted in `localStorage`. All storage and
  `matchMedia` access is guarded so private mode and older browsers degrade to
  `system` rather than throwing.
- **Keep logic testable.** The pure rules (validation, cycle, resolution,
  labels) live in `web/src/theme.ts` and are unit-tested under the 95/90 gate
  ([ADR-0019](0019-vitest-testing-and-coverage.md)); the inline script mirrors
  them in standalone vanilla JS and is built from the same shared string
  constants so the two cannot drift.

## Consequences

- Dark mode works identically on static and hydrated pages with no flash, and
  hosting stays static and Always-Free ([ADR-0016](0016-aws-always-free-cost-discipline.md))
  — the deployable artifact is still plain files.
- This **amends ADR-0021's "static content pages ship no JavaScript."** Those
  pages now carry one small inline script. It is not the hydration bundle and
  pulls in no dependencies; it is consistent with the "one self-contained,
  cacheable asset, no external requests" philosophy.
- An inline `<script>` requires that any future Content-Security-Policy allow it
  (a hash/nonce or `unsafe-inline`). Noted here so a CSP is not bolted on
  without accounting for it.
- New colors must keep going through the token variables; a hardcoded hex would
  silently break one mode. The favicon and leaf mark already use `currentColor`
  / a mid-tone fill, so they read on both.

## Alternatives considered

- **Hydrated React island toggle.** Rejected: content pages load no bundle, so
  the toggle would be dead on most of the site, and a post-hydration class flip
  flashes the wrong theme.
- **`prefers-color-scheme` only, no toggle.** Rejected: no user override and no
  persistence; a visitor cannot pick dark on a light OS.
- **Separate dark stylesheet swapped at runtime.** Rejected: a second network
  asset and a swap flash, versus a zero-request token override on one cached
  file.
