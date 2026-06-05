import { describe, it, expect } from "vitest";
import { indexGroundings } from "../src/grounding.ts";

describe("indexGroundings (ADR-0028)", () => {
  it("keys genuinely-grounded rows by obligation id", () => {
    const idx = indexGroundings([
      {
        obligationId: "a",
        grounded: true,
        confidence: "high",
        snapshotHash: "sha256:h",
        retrievedAt: "2026-05-31",
      },
      { obligationId: "b", grounded: false },
    ]);
    expect(idx.size).toBe(1);
    expect(idx.get("a")?.confidence).toBe("high");
    // A stray ungrounded row never masks seed state.
    expect(idx.has("b")).toBe(false);
  });

  it("is empty for no rows", () => {
    expect(indexGroundings([]).size).toBe(0);
  });
});
