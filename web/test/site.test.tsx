import { describe, it, expect } from "vitest";
import { caRegime } from "@sust-reg/core";
import { buildPages, defaultCorpus } from "../src/site.tsx";

describe("buildPages (ADR-0013)", () => {
  const pages = buildPages(defaultCorpus());
  const byPath = new Map(pages.map((p) => [p.path, p]));

  it("emits home, regimes index, the interactive pages, and a page per obligation", () => {
    expect(byPath.has("index.html")).toBe(true);
    expect(byPath.has("regimes/index.html")).toBe(true);
    expect(byPath.has("scope-checker.html")).toBe(true);
    expect(byPath.has("as-of.html")).toBe(true);
    expect(byPath.has("sources.html")).toBe(true);
    expect(byPath.has("diffs.html")).toBe(true);
    expect(byPath.has("status-states.html")).toBe(true);
    expect(byPath.has("methodology.html")).toBe(true);
    for (const o of caRegime.CALIFORNIA_OBLIGATIONS) {
      expect(byPath.has(`regimes/${o.id}.html`)).toBe(true);
    }
    expect(pages).toHaveLength(8 + caRegime.CALIFORNIA_OBLIGATIONS.length);
  });

  it("flags the interactive pages as needing the hydration bundle", () => {
    expect(byPath.get("scope-checker.html")?.withClient).toBe(true);
    expect(byPath.get("as-of.html")?.withClient).toBe(true);
    expect(byPath.get("sources.html")?.withClient).toBe(true);
    expect(byPath.get("diffs.html")?.withClient).toBe(true);
    expect(byPath.get("index.html")?.withClient).toBe(false);
    expect(byPath.get("regimes/index.html")?.withClient).toBe(false);
    expect(byPath.get("status-states.html")?.withClient).toBe(false);
    expect(byPath.get("methodology.html")?.withClient).toBe(false);
  });

  it("gives every page a title, description, and canonical path", () => {
    for (const page of pages) {
      expect(page.title.length).toBeGreaterThan(0);
      expect(page.description.length).toBeGreaterThan(0);
      expect(page.canonicalPath.startsWith("/")).toBe(true);
    }
  });

  it("is deterministic across repeated builds", () => {
    expect(buildPages(defaultCorpus()).map((p) => p.path)).toEqual(
      pages.map((p) => p.path),
    );
  });
});

describe("defaultCorpus", () => {
  it("serves the v1 California seed obligations (ADR-0009)", () => {
    expect(defaultCorpus()).toBe(caRegime.CALIFORNIA_OBLIGATIONS);
  });
});
