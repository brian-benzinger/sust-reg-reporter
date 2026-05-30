import { describe, it, expect } from "vitest";
import {
  isGrounded,
  UNGROUNDED_SNAPSHOT_HASH,
  type SourceCitation,
} from "../src/citation.ts";

describe("citation grounding (ADR-0004)", () => {
  it("treats the seed sentinel hash as ungrounded", () => {
    const citation: SourceCitation = {
      label: "California SB 261 (2023) — seed",
      snapshotHash: UNGROUNDED_SNAPSHOT_HASH,
    };
    expect(isGrounded(citation)).toBe(false);
  });

  it("treats a real content-addressed snapshot hash as grounded", () => {
    const citation: SourceCitation = {
      label: "California SB 261 (2023), § 38533(b)",
      snapshotHash:
        "sha256:0000000000000000000000000000000000000000000000000000000000000000",
      span: { start: 0, end: 42 },
      retrievedAt: "2026-05-30",
    };
    expect(isGrounded(citation)).toBe(true);
  });
});
