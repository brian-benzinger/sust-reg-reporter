import { describe, it, expect } from "vitest";
import { caRegime } from "@sust-reg/core";
import {
  buildDefaultSite,
  buildSite,
  defaultCorpus,
} from "../src/site.ts";
import { NOT_LEGAL_ADVICE } from "../src/render.ts";

describe("buildSite (ADR-0013)", () => {
  const files = buildDefaultSite();
  const byPath = new Map(files.map((f) => [f.path, f.contents]));

  it("emits the stylesheet, home, regimes index, and a page per obligation", () => {
    expect(byPath.has("styles.css")).toBe(true);
    expect(byPath.has("index.html")).toBe(true);
    expect(byPath.has("regimes/index.html")).toBe(true);
    for (const o of caRegime.CALIFORNIA_OBLIGATIONS) {
      expect(byPath.has(`regimes/${o.id}.html`)).toBe(true);
    }
    // styles + home + regimes index + one per obligation.
    expect(files).toHaveLength(3 + caRegime.CALIFORNIA_OBLIGATIONS.length);
  });

  it("strips the leading slash from the stylesheet output path", () => {
    expect(byPath.has("/styles.css")).toBe(false);
    expect(byPath.get("styles.css")).toContain(".badge");
  });

  it("carries the non-interpretive disclaimer on every HTML page", () => {
    for (const file of files) {
      if (file.path.endsWith(".html")) {
        expect(file.contents).toContain(NOT_LEGAL_ADVICE);
      }
    }
  });

  it("is deterministic across repeated builds", () => {
    expect(buildSite(defaultCorpus())).toEqual(buildSite(defaultCorpus()));
  });
});

describe("defaultCorpus", () => {
  it("serves the v1 California seed obligations (ADR-0009)", () => {
    expect(defaultCorpus()).toBe(caRegime.CALIFORNIA_OBLIGATIONS);
  });
});
