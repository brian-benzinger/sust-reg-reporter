# 0019 — Vitest for testing and per-file coverage enforcement

- **Status:** Accepted (supersedes the testing-tooling decision of [ADR-0018](0018-shared-core-domain-workspace.md))
- **Date:** 2026-05-30

## Context

[ADR-0018](0018-shared-core-domain-workspace.md) introduced the `core` workspace
and, to keep it dependency-free, ran its tests on Node's built-in test runner
with native TypeScript type-stripping. That kept zero dependencies, but the
project's stated core contribution is the reliability and quality layer
([ADR-0017](0017-reliability-and-quality-layer.md)), which depends on an
*enforced* coverage bar.

Two gaps surfaced once we tried to enforce that bar:

- Node's built-in coverage thresholds (`--test-coverage-lines` /
  `--test-coverage-branches`) check only the **whole-project aggregate**, so a
  weak file hides behind well-tested ones. Enforcing a **per-file** bar required
  hand-writing a bespoke custom reporter.
- The built-in runner's developer experience (watch mode, rich assertions,
  mocking, fixtures) is thin for the test-heavy work ahead — the applicability
  engine, ingestion, and the API contract.

## Decision

Use **Vitest** as the test runner and coverage tool across the monorepo, and
**enforce coverage per file**: **95% line, 90% branch**, via
`coverage.thresholds.perFile` with the v8 provider. The thresholds live in
`vitest.config.ts` and run in CI on every pull request, so the gate cannot
drift.

Vitest is a **dev-only dependency**. The substantive intent of ADR-0018 — that
the `core` workspace carry **no runtime dependencies** — is preserved; only the
test-tooling choice is superseded.

## Consequences

- Per-file coverage is enforced natively and declaratively, replacing the custom
  reporter. The 95/90 bar is a hard gate locally and in CI from the first
  testable code.
- Better DX (watch, `expect`, mocking) for the domain-heavy testing ahead.
- Adds `vitest` and `@vitest/coverage-v8` to devDependencies; the repo is no
  longer dependency-free at the tooling layer, but `core` remains free of
  runtime dependencies.
- ADR-0018's `core` workspace and its zero-runtime-dependency principle stand;
  only its test-tooling sub-decision is superseded by this record.

## Alternatives considered

- **Keep `node:test` + a custom per-file gate reporter.** Rejected: bespoke,
  more code to maintain, aggregate-only native thresholds, and weaker DX.
- **`c8` over `node:test`.** Rejected: still stitches multiple tools together to
  approximate what Vitest does natively.
- **Jest.** Rejected: heavier, slower, and a weaker ESM/TypeScript story than
  Vitest for an ESM TypeScript monorepo.
