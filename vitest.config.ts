import { defineConfig } from "vitest/config";

/**
 * Test + coverage configuration for the monorepo (ADR-0019).
 *
 * Coverage is enforced PER FILE — 95% line, 90% branch — so a weak file cannot
 * hide behind well-tested ones. The gate runs locally (`npm test`) and in CI on
 * every PR, so it cannot drift. This is the reliability/quality bar that is the
 * project's core contribution (ADR-0017).
 */
export default defineConfig({
  test: {
    include: ["**/test/**/*.test.ts"],
    coverage: {
      provider: "v8",
      // Add each workspace's source as it gains testable code.
      // Entrypoints that are pure I/O glue (infra/bin, web/bin) are excluded —
      // they are glue, not logic.
      include: ["core/src/**/*.ts", "infra/lib/**/*.ts", "web/src/**/*.ts"],
      reporter: ["text", "html"],
      thresholds: {
        perFile: true,
        lines: 95,
        branches: 90,
      },
    },
  },
});
