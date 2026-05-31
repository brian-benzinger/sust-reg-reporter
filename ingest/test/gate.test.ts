import { describe, it, expect } from "vitest";
import { hasChanged } from "../src/gate.ts";

describe("content-hash change gate (ADR-0007, ADR-0010)", () => {
  it("treats a first-ever fetch (no last-seen hash) as changed", () => {
    expect(hasChanged("sha256:abc", undefined)).toBe(true);
  });

  it("is unchanged when the hash matches the last seen", () => {
    expect(hasChanged("sha256:abc", "sha256:abc")).toBe(false);
  });

  it("is changed when the hash differs from the last seen", () => {
    expect(hasChanged("sha256:abc", "sha256:def")).toBe(true);
  });
});
