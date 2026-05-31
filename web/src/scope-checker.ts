/**
 * Scope Checker logic (ADR-0005 made interactive).
 *
 * Pure, DOM-free functions that turn raw form strings into a `CompanyProfile`,
 * run the shared applicability engine, and shape the result for display. The
 * React component (ScopeChecker.tsx) is a thin shell over these functions, so
 * the conditional logic — the high-value, error-prone part — is unit-tested
 * without a browser.
 *
 * Scope discipline (ADR-0002): output is the engine's factual determination
 * (which obligations apply, why, and whether enforcement is active). It is not
 * advice.
 */
import {
  type ApplicabilityResult,
  type CompanyProfile,
  type ListingStatus,
  type Obligation,
  evaluateApplicability,
} from "@sust-reg/core";

/** The listing statuses the form offers, in display order. */
export const LISTING_STATUSES: readonly ListingStatus[] = [
  "private",
  "public-us",
  "public-eu",
  "public-other",
];

export interface ScopeFormInput {
  readonly revenue: string;
  readonly jurisdictions: string;
  readonly listingStatus: string;
  readonly fiscalYearEnd: string;
}

/** Sensible, illustrative defaults so the page renders a worked example. */
export const DEFAULT_FORM_INPUT: ScopeFormInput = {
  revenue: "750000000",
  jurisdictions: "US-CA",
  listingStatus: "public-us",
  fiscalYearEnd: "12-31",
};

/** Split a free-text jurisdictions field into trimmed, non-empty codes. */
export function parseJurisdictions(raw: string): string[] {
  return raw
    .split(/[\s,]+/)
    .map((code) => code.trim())
    .filter((code) => code.length > 0);
}

function isListingStatus(value: string): value is ListingStatus {
  return (LISTING_STATUSES as readonly string[]).includes(value);
}

export interface ParsedProfile {
  readonly profile: CompanyProfile;
  readonly errors: readonly string[];
}

/**
 * Parse and validate the form into a `CompanyProfile`. Invalid fields are
 * reported as errors and fall back to a safe default so evaluation can still
 * run and show partial results rather than blanking out.
 */
export function parseProfile(input: ScopeFormInput): ParsedProfile {
  const errors: string[] = [];

  const revenue = Number(input.revenue);
  let totalAnnualRevenueUSD = 0;
  if (input.revenue.trim() === "" || Number.isNaN(revenue) || revenue < 0) {
    errors.push("Revenue must be a number of USD that is zero or greater.");
  } else {
    totalAnnualRevenueUSD = revenue;
  }

  let listingStatus: ListingStatus = "private";
  if (isListingStatus(input.listingStatus)) {
    listingStatus = input.listingStatus;
  } else {
    errors.push(`Unknown listing status "${input.listingStatus}".`);
  }

  if (!/^\d{2}-\d{2}$/.test(input.fiscalYearEnd)) {
    errors.push('Fiscal year end must be in "MM-DD" format, e.g. 12-31.');
  }

  const profile: CompanyProfile = {
    totalAnnualRevenueUSD,
    jurisdictions: parseJurisdictions(input.jurisdictions),
    listingStatus,
    fiscalYearEnd: input.fiscalYearEnd,
  };

  return { profile, errors };
}

export interface ScopeCheckView {
  readonly results: readonly ApplicabilityResult[];
  readonly applicableCount: number;
  readonly enforceableCount: number;
}

/** Run the applicability engine and summarize for display. */
export function runScopeCheck(
  profile: CompanyProfile,
  obligations: readonly Obligation[],
): ScopeCheckView {
  const results = evaluateApplicability(profile, obligations);
  return {
    results,
    applicableCount: results.filter((r) => r.applies).length,
    enforceableCount: results.filter((r) => r.enforceable).length,
  };
}
