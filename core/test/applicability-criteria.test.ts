import { describe, it, expect } from "vitest";
import {
  evaluateObligation,
  type CompanyProfile,
  type Obligation,
} from "../src/applicability.ts";
import { UNGROUNDED_SNAPSHOT_HASH } from "../src/citation.ts";

const profile = (overrides: Partial<CompanyProfile> = {}): CompanyProfile => ({
  totalAnnualRevenueUSD: 600_000_000,
  jurisdictions: ["US-CA"],
  listingStatus: "private",
  fiscalYearEnd: "12-31",
  ...overrides,
});

const obligation = (criteria: Obligation["criteria"]): Obligation => ({
  id: "test-ob",
  regime: "TEST",
  title: "Test obligation",
  status: "in-effect",
  criteria,
  source: { label: "test — ungrounded", snapshotHash: UNGROUNDED_SNAPSHOT_HASH },
});

describe("applicability criteria edges (ADR-0005)", () => {
  describe("listingStatusIn", () => {
    it("applies when listing status is in the allowed set", () => {
      const r = evaluateObligation(
        profile({ listingStatus: "public-us" }),
        obligation({ listingStatusIn: ["public-us", "public-eu"] }),
      );
      expect(r.applies).toBe(true);
      expect(r.reasons.some((x) => x.includes("is one of"))).toBe(true);
    });

    it("does not apply when listing status is outside the allowed set", () => {
      const r = evaluateObligation(
        profile({ listingStatus: "private" }),
        obligation({ listingStatusIn: ["public-us"] }),
      );
      expect(r.applies).toBe(false);
      expect(r.reasons.some((x) => x.includes("is not"))).toBe(true);
    });
  });

  describe("excludedIfListingStatusIn (carve-out)", () => {
    it("excludes a profile whose listing status is carved out", () => {
      const r = evaluateObligation(
        profile({ listingStatus: "public-eu" }),
        obligation({ excludedIfListingStatusIn: ["public-eu"] }),
      );
      expect(r.applies).toBe(false);
      expect(r.reasons.some((x) => x.includes("carved out"))).toBe(true);
    });

    it("does not exclude a profile outside the carve-out set", () => {
      const r = evaluateObligation(
        profile({ listingStatus: "private" }),
        obligation({ excludedIfListingStatusIn: ["public-eu"] }),
      );
      expect(r.applies).toBe(true);
    });
  });
});
