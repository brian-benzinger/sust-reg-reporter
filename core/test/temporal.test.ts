import { describe, it, expect } from "vitest";
import {
  type TemporalFact,
  latestRecordedAt,
  resolveAsOf,
  resolveValueAsOf,
} from "../src/temporal.ts";
import {
  SB_261_STATUS_HISTORY,
  CALIFORNIA_STATUS_HISTORIES,
} from "../src/regimes/ca-sb253-261.ts";

type S = "a" | "b" | "c";

const facts: TemporalFact<S>[] = [
  { value: "a", validFrom: "2023-01-01", validTo: "2024-01-01", recordedAt: "2023-01-01" },
  { value: "b", validFrom: "2024-01-01", recordedAt: "2024-01-01" },
  // Correction: recorded later, supersedes "b" for valid dates from 2024-06-01.
  { value: "c", validFrom: "2024-06-01", recordedAt: "2025-01-01" },
];

describe("resolveAsOf (ADR-0003)", () => {
  it("selects the fact whose valid interval contains the date", () => {
    expect(
      resolveValueAsOf(facts, { validOn: "2023-06-01", knownAsOf: "2025-12-31" }),
    ).toBe("a");
  });

  it("treats validTo as exclusive and an omitted validTo as open-ended", () => {
    // 2024-01-01 is excluded from "a" (validTo) and included in "b" (validFrom).
    expect(
      resolveValueAsOf(facts, { validOn: "2024-01-01", knownAsOf: "2024-01-01" }),
    ).toBe("b");
    // Far-future date still resolves against the open-ended correction.
    expect(
      resolveValueAsOf(facts, { validOn: "2030-01-01", knownAsOf: "2025-12-31" }),
    ).toBe("c");
  });

  it("hides facts not yet recorded at the knowledge date (transaction time)", () => {
    // As known in 2024, the 2025 correction is invisible → still "b".
    expect(
      resolveValueAsOf(facts, { validOn: "2024-09-01", knownAsOf: "2024-09-01" }),
    ).toBe("b");
    // As known in 2025, the correction supersedes → "c".
    expect(
      resolveValueAsOf(facts, { validOn: "2024-09-01", knownAsOf: "2025-06-01" }),
    ).toBe("c");
  });

  it("returns undefined when nothing is both known and valid", () => {
    // Before any valid period.
    expect(
      resolveAsOf(facts, { validOn: "2022-01-01", knownAsOf: "2025-12-31" }),
    ).toBeUndefined();
    // Before anything was recorded.
    expect(
      resolveAsOf(facts, { validOn: "2023-06-01", knownAsOf: "2022-01-01" }),
    ).toBeUndefined();
  });

  it("keeps the earlier fact on a recordedAt tie (deterministic)", () => {
    const tie: TemporalFact<S>[] = [
      { value: "a", validFrom: "2023-01-01", recordedAt: "2023-01-01" },
      { value: "b", validFrom: "2023-01-01", recordedAt: "2023-01-01" },
    ];
    expect(
      resolveValueAsOf(tie, { validOn: "2023-05-01", knownAsOf: "2023-05-01" }),
    ).toBe("a");
  });
});

describe("latestRecordedAt", () => {
  it("returns the most recent transaction-time date", () => {
    expect(latestRecordedAt(facts)).toBe("2025-01-01");
  });

  it("returns undefined for an empty history", () => {
    expect(latestRecordedAt([])).toBeUndefined();
  });
});

describe("SB 261 seed history (the bitemporal showcase)", () => {
  it("resolves the same valid date differently as knowledge advances", () => {
    const validOn = "2025-03-01";
    expect(
      resolveValueAsOf(SB_261_STATUS_HISTORY, { validOn, knownAsOf: "2024-08-01" }),
    ).toBe("in-effect");
    expect(
      resolveValueAsOf(SB_261_STATUS_HISTORY, { validOn, knownAsOf: "2025-06-01" }),
    ).toBe("stayed");
  });

  it("exposes both California obligations' histories", () => {
    expect(CALIFORNIA_STATUS_HISTORIES.map((h) => h.regime)).toEqual([
      "CA-SB253",
      "CA-SB261",
    ]);
  });
});
