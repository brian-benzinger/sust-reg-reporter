import { describe, it, expect } from "vitest";
import {
  groundedCitation,
  latestGrounding,
  type GroundingFact,
} from "../src/grounding.ts";
import { isGrounded, type SourceCitation } from "../src/citation.ts";

const fact = (over: Partial<GroundingFact>): GroundingFact => ({
  sourceKey: "ca-sb261-2023",
  sourceVersionId: "v1",
  snapshotHash: "sha256:abc",
  retrievedAt: "2026-05-01",
  method: "document",
  confidence: "high",
  recordedAt: "2026-05-01",
  ...over,
});

describe("latestGrounding (ADR-0028, transaction-time resolution)", () => {
  it("returns undefined when there are no grounding facts", () => {
    expect(latestGrounding([])).toBeUndefined();
  });

  it("returns the only fact when there is one", () => {
    const f = fact({});
    expect(latestGrounding([f])).toBe(f);
  });

  it("returns the most recently recorded fact (a re-grounding wins)", () => {
    const older = fact({ snapshotHash: "sha256:old", recordedAt: "2026-05-01" });
    const newer = fact({ snapshotHash: "sha256:new", recordedAt: "2026-06-01" });
    expect(latestGrounding([older, newer])?.snapshotHash).toBe("sha256:new");
    // Order-independent.
    expect(latestGrounding([newer, older])?.snapshotHash).toBe("sha256:new");
  });

  it("hides a grounding recorded after the knowledge date", () => {
    const older = fact({ snapshotHash: "sha256:old", recordedAt: "2026-05-01" });
    const newer = fact({ snapshotHash: "sha256:new", recordedAt: "2026-06-01" });
    // As we knew it on 2026-05-15, only the older grounding was recorded.
    expect(latestGrounding([older, newer], "2026-05-15")?.snapshotHash).toBe(
      "sha256:old",
    );
    // Before any grounding existed → ungrounded at that knowledge point.
    expect(latestGrounding([older, newer], "2026-04-01")).toBeUndefined();
  });

  it("keeps the earlier fact in the list on a recordedAt tie (deterministic)", () => {
    const a = fact({ snapshotHash: "sha256:a", recordedAt: "2026-05-01" });
    const b = fact({ snapshotHash: "sha256:b", recordedAt: "2026-05-01" });
    expect(latestGrounding([a, b])?.snapshotHash).toBe("sha256:a");
  });
});

describe("groundedCitation (ADR-0028 §3, derived citation)", () => {
  const seed: SourceCitation = {
    label: "California SB 261 (2023) — seed, ungrounded",
    snapshotHash: "ungrounded:seed",
    sourceUrl: "https://example.test/sb261",
  };

  it("returns the seed citation unchanged when ungrounded", () => {
    const out = groundedCitation(seed, undefined);
    expect(out).toBe(seed);
    expect(isGrounded(out)).toBe(false);
  });

  it("pins to the snapshot hash + retrieval date for a document-level grounding", () => {
    const out = groundedCitation(seed, fact({ snapshotHash: "sha256:real" }));
    expect(out.snapshotHash).toBe("sha256:real");
    expect(out.retrievedAt).toBe("2026-05-01");
    expect(out.span).toBeUndefined();
    // The human label and canonical URL are preserved from the seed.
    expect(out.label).toBe(seed.label);
    expect(out.sourceUrl).toBe("https://example.test/sb261");
    expect(isGrounded(out)).toBe(true);
  });

  it("carries the character span when the grounding is span-level", () => {
    const out = groundedCitation(
      seed,
      fact({ snapshotHash: "sha256:real", method: "span", span: { start: 10, end: 42 } }),
    );
    expect(out.span).toEqual({ start: 10, end: 42 });
    expect(isGrounded(out)).toBe(true);
  });

  it("omits sourceUrl when the seed had none", () => {
    const bare: SourceCitation = { label: "x", snapshotHash: "ungrounded:seed" };
    const out = groundedCitation(bare, fact({ snapshotHash: "sha256:real" }));
    expect(out.sourceUrl).toBeUndefined();
  });
});
