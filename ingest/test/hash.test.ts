import { describe, it, expect } from "vitest";
import { contentHash } from "../src/hash.ts";

describe("contentHash (ADR-0011)", () => {
  it("is the sha256 of the content, prefixed sha256:", () => {
    expect(contentHash("")).toBe(
      "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });

  it("is identical for identical content (the dedup signal)", () => {
    expect(contentHash("hello")).toBe(contentHash("hello"));
  });

  it("differs when the content differs", () => {
    expect(contentHash("a")).not.toBe(contentHash("b"));
  });

  it("hashes raw bytes the same as the equivalent string", () => {
    expect(contentHash(new Uint8Array([104, 105]))).toBe(contentHash("hi"));
  });
});
