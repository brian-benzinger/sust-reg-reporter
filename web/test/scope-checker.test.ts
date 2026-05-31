import { describe, it, expect } from "vitest";
import type { CompanyProfile, Obligation } from "@sust-reg/core";
import {
  DEFAULT_FORM_INPUT,
  LISTING_STATUSES,
  parseJurisdictions,
  parseProfile,
  runScopeCheck,
} from "../src/scope-checker.ts";

describe("parseJurisdictions", () => {
  it("splits on commas and whitespace, dropping blanks", () => {
    expect(parseJurisdictions(" US-CA, US  EU ,")).toEqual([
      "US-CA",
      "US",
      "EU",
    ]);
  });

  it("returns an empty list for empty input", () => {
    expect(parseJurisdictions("   ")).toEqual([]);
  });
});

describe("parseProfile", () => {
  it("parses a valid form with no errors", () => {
    const { profile, errors } = parseProfile(DEFAULT_FORM_INPUT);
    expect(errors).toEqual([]);
    expect(profile).toEqual({
      totalAnnualRevenueUSD: 750_000_000,
      jurisdictions: ["US-CA"],
      listingStatus: "public-us",
      fiscalYearEnd: "12-31",
    } satisfies CompanyProfile);
  });

  it("flags blank, non-numeric, and negative revenue and falls back to 0", () => {
    for (const revenue of ["", "abc", "-5"]) {
      const { profile, errors } = parseProfile({
        ...DEFAULT_FORM_INPUT,
        revenue,
      });
      expect(profile.totalAnnualRevenueUSD).toBe(0);
      expect(errors.some((e) => e.includes("Revenue"))).toBe(true);
    }
  });

  it("flags an unknown listing status and falls back to private", () => {
    const { profile, errors } = parseProfile({
      ...DEFAULT_FORM_INPUT,
      listingStatus: "bogus",
    });
    expect(profile.listingStatus).toBe("private");
    expect(errors.some((e) => e.includes("listing status"))).toBe(true);
  });

  it("accepts every offered listing status without error", () => {
    for (const status of LISTING_STATUSES) {
      const { errors } = parseProfile({
        ...DEFAULT_FORM_INPUT,
        listingStatus: status,
      });
      expect(errors).toEqual([]);
    }
  });

  it("flags a malformed fiscal year end", () => {
    const { errors } = parseProfile({
      ...DEFAULT_FORM_INPUT,
      fiscalYearEnd: "Dec 31",
    });
    expect(errors.some((e) => e.includes("MM-DD"))).toBe(true);
  });
});

const mk = (id: string, over: Partial<Obligation>): Obligation => ({
  id,
  regime: "TEST",
  title: id,
  status: "in-effect",
  criteria: {},
  source: { label: id, snapshotHash: "sha256:x" },
  ...over,
});

describe("runScopeCheck", () => {
  it("counts applicable and enforceable obligations", () => {
    const profile: CompanyProfile = {
      totalAnnualRevenueUSD: 1_000,
      jurisdictions: ["US-CA"],
      listingStatus: "private",
      fiscalYearEnd: "12-31",
    };
    const obligations: Obligation[] = [
      mk("applies-enforced", {
        status: "enforced",
        criteria: { minTotalAnnualRevenueUSD: 500 },
      }),
      mk("applies-stayed", {
        status: "stayed",
        criteria: { minTotalAnnualRevenueUSD: 500 },
      }),
      mk("excluded", { criteria: { minTotalAnnualRevenueUSD: 5_000 } }),
    ];
    const view = runScopeCheck(profile, obligations);
    expect(view.results).toHaveLength(3);
    expect(view.applicableCount).toBe(2);
    expect(view.enforceableCount).toBe(1);
  });
});
