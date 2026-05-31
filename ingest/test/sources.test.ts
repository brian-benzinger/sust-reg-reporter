import { describe, it, expect } from "vitest";
import { SOURCES, getSource } from "../src/sources.ts";

describe("source registry (ADR-0008, ADR-0009)", () => {
  it("has at least one source, each with a key, https url, and authority", () => {
    expect(SOURCES.length).toBeGreaterThan(0);
    for (const s of SOURCES) {
      expect(s.key).toMatch(/\S/);
      expect(s.name).toMatch(/\S/);
      expect(s.url).toMatch(/^https:\/\//);
      expect(s.authority).toMatch(/\S/);
    }
  });

  it("has unique source keys", () => {
    const keys = SOURCES.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("looks a source up by key (and misses cleanly)", () => {
    const first = SOURCES[0];
    expect(getSource(first!.key)).toEqual(first);
    expect(getSource("does-not-exist")).toBeUndefined();
  });
});
