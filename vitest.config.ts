import { coverageConfigDefaults, defineConfig } from "vitest/config";

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
    include: ["**/test/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      // Add each workspace's source as it gains testable code. Entrypoints that
      // are pure glue — the CDK app (infra/bin) and the web client/prerender
      // entries — are excluded; they are wiring, not logic.
      include: [
        "core/src/**/*.ts",
        "infra/lib/**/*.ts",
        "ingest/src/**/*.ts",
        "web/src/**/*.{ts,tsx}",
      ],
      exclude: [
        ...coverageConfigDefaults.exclude,
        "ingest/src/handlers/**",
        "web/src/client.tsx",
        "web/src/prerender.tsx",
      ],
      reporter: ["text", "html"],
      thresholds: {
        perFile: true,
        lines: 95,
        branches: 90,
      },
    },
  },
});
