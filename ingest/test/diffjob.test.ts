import { describe, it, expect } from "vitest";
import type { Classifier } from "semdiff";
import { runDiffJob, type DiffDeps, type DiffRecord } from "../src/diffjob.ts";

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
    expect(recorded?.engineVersion).toBe("0.1.1");
    expect(JSON.parse(recorded!.changes).length).toBeGreaterThan(0);
  });
});
