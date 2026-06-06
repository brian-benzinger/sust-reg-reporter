import { describe, it, expect } from "vitest";
import type { Classifier } from "semdiff";
import { diffSnapshots } from "../src/diff.ts";

// A deterministic stand-in for the LLM classifier — keeps the test offline,
// free, and reproducible (the real classifier is injected in production via
// ANTHROPIC_API_KEY). It judges every changed pair substantive.
const stubClassifier: Classifier = {
  classify: async () => ({
    classification: "substantive",
    description: "threshold changed",
    confidence: 1,
  }),
};

describe("diffSnapshots (ADR-0007)", () => {
  it("reports no changes for identical text (no classifier needed)", async () => {
    const text = "Covered entities must report climate risk annually.";
    const result = await diffSnapshots(text, text);
    expect(result.changes).toHaveLength(0);
    expect(result.summary.substantive).toBe(0);
  });

  it("surfaces a substantive change via the injected classifier", async () => {
    const before = "Companies with revenue over $1B must report.";
    const after = "Companies with revenue over $500M must report.";
    const result = await diffSnapshots(before, after, stubClassifier);

    expect(result.summary.substantive).toBeGreaterThan(0);
    const change = result.changes.find(
      (c) => c.classification === "substantive",
    );
    expect(change).toBeDefined();
    // Spans index the literal input, so they resolve against a stored snapshot
    // (citation integrity, ADR-0004).
    expect(change?.spanB?.start).toBeTypeOf("number");
  });

  it("stamps the engine provenance and schema version (ADR-0004)", async () => {
    const result = await diffSnapshots("a b c.", "a b c.");
    expect(result.provenance.engineVersion).toBe("0.1.2");
    expect(result.schemaVersion).toBe("1.0.0");
  });

  it("flags every change for review without paid classification when over the cap", async () => {
    let paidCalls = 0;
    const counting: Classifier = {
      classify: async () => {
        paidCalls += 1;
        return { classification: "substantive", confidence: 1 };
      },
    };
    const before = "Companies with revenue over $1B must report annually.";
    const after = "Firms earning above $500M shall file a disclosure each year.";
    // maxChanges = 0 forces the cap, standing in for a whole-document replacement.
    const result = await diffSnapshots(before, after, counting, 0);
    expect(result.changes.length).toBeGreaterThan(0);
    // The injected (paid) classifier was never called; all changes are flagged.
    expect(paidCalls).toBe(0);
    expect(result.summary.needsReview).toBe(result.changes.length);
  });
});
