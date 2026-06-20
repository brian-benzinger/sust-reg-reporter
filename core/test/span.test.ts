import { describe, it, expect } from "vitest";
import { resolveSpan, type TextQuoteLocator } from "../src/span.ts";

describe("resolveSpan (ADR-0035, text-quote anchor resolution)", () => {
  it("returns undefined for an empty quote", () => {
    expect(resolveSpan({ quote: "" }, "anything at all")).toBeUndefined();
  });

  it("returns undefined when the quote is absent from the snapshot", () => {
    expect(resolveSpan({ quote: "missing" }, "the present text")).toBeUndefined();
  });

  it("resolves a unique quote to exact offsets at high confidence", () => {
    const text = "alpha beta gamma";
    expect(resolveSpan({ quote: "beta" }, text)).toEqual({
      start: 6,
      end: 10,
      confidence: "high",
    });
    // The offsets really delimit the quote.
    expect(text.slice(6, 10)).toBe("beta");
  });

  it("takes the first occurrence at medium confidence when a quote repeats", () => {
    expect(resolveSpan({ quote: "foo" }, "foo bar foo")).toEqual({
      start: 0,
      end: 3,
      confidence: "medium",
    });
  });

  it("counts overlapping occurrences as repeats (medium, not high)", () => {
    // "aa" occurs at 0, 1, 2 in "aaaa" — overlapping; must not read as unique.
    expect(resolveSpan({ quote: "aa" }, "aaaa")).toEqual({
      start: 0,
      end: 2,
      confidence: "medium",
    });
  });

  it("uses a prefix to disambiguate repeats to a single match (high)", () => {
    const text = "red apple green apple";
    expect(resolveSpan({ quote: "apple", prefix: "green " }, text)).toEqual({
      start: 16,
      end: 21,
      confidence: "high",
    });
    expect(text.slice(16, 21)).toBe("apple");
  });

  it("uses a suffix alone to disambiguate (high), with no prefix", () => {
    const text = "apple pie apple tart";
    expect(resolveSpan({ quote: "apple", suffix: " tart" }, text)).toEqual({
      start: 10,
      end: 15,
      confidence: "high",
    });
  });

  it("uses both prefix and suffix together to pin the right occurrence (high)", () => {
    const text = "x mid y x mid z";
    expect(
      resolveSpan({ quote: "mid", prefix: "x ", suffix: " y" }, text),
    ).toEqual({ start: 2, end: 5, confidence: "high" });
  });

  it("returns medium when context still leaves more than one candidate", () => {
    // "ab" at 0, 5, 10; suffix " x" matches the first two only.
    const text = "ab x ab x ab";
    expect(resolveSpan({ quote: "ab", suffix: " x" }, text)).toEqual({
      start: 0,
      end: 2,
      confidence: "medium",
    });
  });

  it("falls back to the first raw occurrence at low confidence when context matches nothing", () => {
    // The quote is present, but the prefix is stale/wrong — degrade, don't drop.
    const text = "hello world";
    const locator: TextQuoteLocator = { quote: "world", prefix: "xyz" };
    expect(resolveSpan(locator, text)).toEqual({
      start: 6,
      end: 11,
      confidence: "low",
    });
  });

  it("treats a present-but-wrong suffix as stale context (low)", () => {
    const text = "the quick brown fox";
    expect(
      resolveSpan({ quote: "quick", suffix: " slow" }, text),
    ).toEqual({ start: 4, end: 9, confidence: "low" });
  });
});
