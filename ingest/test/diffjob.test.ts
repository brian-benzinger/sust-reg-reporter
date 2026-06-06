import { describe, it, expect } from "vitest";
import type { Classifier } from "semdiff";
import {
  changesWithText,
  runDiffJob,
  type DiffDeps,
  type DiffRecord,
} from "../src/diffjob.ts";

const stubClassifier: Classifier = {
  classify: async () => ({
    classification: "substantive",
    description: "threshold changed",
    confidence: 1,
  }),
};

describe("runDiffJob (ADR-0007)", () => {
  it("reads before/after by hash, diffs, and persists a StructuredDiff", async () => {
    const snapshots: Record<string, string> = {
      "sha256:a": "Companies over $1B must report.",
      "sha256:b": "Companies over $500M must report.",
    };
    let recorded: DiffRecord | undefined;

    const deps: DiffDeps = {
      getSnapshot: async (h) => snapshots[h] ?? "",
      classifier: () => stubClassifier,
      recordDiff: async (r) => {
        recorded = r;
      },
    };

    const out = await runDiffJob(deps, {
      sourceKey: "demo",
      fromVersionId: "v1",
      fromHash: "sha256:a",
      toVersionId: "v2",
      toHash: "sha256:b",
    });

    expect(out.substantive).toBeGreaterThan(0);
    expect(recorded).toBeDefined();
    expect(recorded?.sourceKey).toBe("demo");
    expect(recorded?.toVersionId).toBe("v2");
    expect(recorded?.engineVersion).toBe("0.1.2");
    const changes = JSON.parse(recorded!.changes);
    expect(changes.length).toBeGreaterThan(0);
    // The persisted change carries the literal before/after prose, not just spans.
    expect(changes[0].textA).toBe("Companies over $1B must report.");
    expect(changes[0].textB).toBe("Companies over $500M must report.");
  });
});

describe("changesWithText (ADR-0007)", () => {
  it("slices the before/after text for each span; a null span is empty", () => {
    const before = "alpha beta gamma";
    const after = "alpha delta gamma";
    const changes = [
      { spanA: { start: 6, end: 10 }, spanB: { start: 6, end: 11 } }, // beta -> delta
      { spanA: null, spanB: { start: 0, end: 5 } }, // insertion
      { spanA: { start: 0, end: 5 }, spanB: null }, // deletion
    ] as unknown as Parameters<typeof changesWithText>[0];

    const out = changesWithText(changes, before, after);
    expect(out[0]).toMatchObject({ textA: "beta", textB: "delta" });
    expect(out[1]).toMatchObject({ textA: "", textB: "alpha" });
    expect(out[2]).toMatchObject({ textA: "alpha", textB: "" });
  });
});
