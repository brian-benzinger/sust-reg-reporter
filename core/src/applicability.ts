/**
 * Applicability engine (ADR-0005).
 *
 * Given a company profile, determine which disclosure obligations apply and by
 * when. This is conditional, threshold-driven logic, not a lookup, and it is
 * the highest-value and hardest piece of the system.
 *
 * Scope discipline (ADR-0002): this engine reports *which obligations apply and
 * by when* as structured, threshold-derived fact. It does NOT advise on what to
 * do about them. Each result carries the reasons it matched and the source
 * citation behind the obligation so the determination is verifiable, never
 * authoritative on its own.
 */
import type { SourceCitation } from "./citation.ts";
import { isCurrentlyEnforced, isLaw, type RegulationStatus } from "./status.ts";

/**
 * The facts about a company needed to evaluate applicability. These are the
 * four axes named in the brief: revenue, jurisdictions of operation, listing
 * status, and fiscal year end.
 */
export interface CompanyProfile {
  /** Total annual revenue in USD (the comparable basis for thresholds). */
  readonly totalAnnualRevenueUSD: number;

  /**
   * Jurisdictions the company operates in / does business in, as opaque codes
   * (e.g. "US-CA", "US", "EU"). Matching is membership-based, not hierarchical:
   * a rule that requires "US-CA" must list "US-CA" here explicitly.
   */
  readonly jurisdictions: readonly string[];

  /** How the company is listed, if at all. */
  readonly listingStatus: ListingStatus;

  /** Fiscal year end as "MM-DD" (e.g. "12-31"). Used to resolve deadlines. */
  readonly fiscalYearEnd: string;
}

export type ListingStatus =
  | "private"
  | "public-us"
  | "public-eu"
  | "public-other";

/**
 * The conditions under which an obligation applies. Every field is optional;
 * an omitted field is "no constraint on this axis". All present fields must be
 * satisfied (logical AND).
 */
export interface ApplicabilityCriteria {
  /** Applies only if revenue is at least this many USD. */
  readonly minTotalAnnualRevenueUSD?: number;
  /** Applies only if the company operates in ANY of these jurisdictions. */
  readonly operatesInAnyOf?: readonly string[];
  /** Applies only if listing status is one of these. */
  readonly listingStatusIn?: readonly ListingStatus[];
  /** Does NOT apply if listing status is one of these (carve-out). */
  readonly excludedIfListingStatusIn?: readonly ListingStatus[];
}

/**
 * A single disclosure obligation in a regime. Status and citation are
 * first-class: an obligation cannot exist in the model without provenance
 * (ADR-0004) or without an explicit lifecycle state (ADR-0006).
 */
export interface Obligation {
  readonly id: string;
  /** Regime key, e.g. "CA-SB261", "EU-CSRD", "ISSB-S2". */
  readonly regime: string;
  readonly title: string;
  readonly status: RegulationStatus;
  readonly criteria: ApplicabilityCriteria;
  /**
   * The first reporting deadline as an ISO-8601 date, if fixed. Phase one
   * treats this as a stored fact; resolving deadlines relative to a company's
   * fiscal year end is deferred to a later iteration.
   */
  readonly firstReportingDeadline?: string;
  readonly source: SourceCitation;
  /**
   * The registry source key (`ingest` `sources.ts`) whose ingested snapshots
   * substantiate this obligation, if one is registered (ADR-0028). The pipeline
   * grounds the obligation to that source's latest snapshot; an obligation with
   * no `sourceKey` has no authoritative source yet and stays ungrounded.
   */
  readonly sourceKey?: string;
}

export interface ApplicabilityResult {
  readonly obligation: Obligation;
  /** Does this obligation apply to the profile, on the criteria alone? */
  readonly applies: boolean;
  /**
   * Plain-fact explanation of each criterion's outcome (e.g. "revenue
   * $600,000,000 ≥ threshold $500,000,000"). Factual, not advisory.
   */
  readonly reasons: readonly string[];
  /**
   * Whether the obligation is currently enforceable: it both applies and its
   * status is actively enforced. A `stayed` obligation that applies has
   * `applies: true` but `enforceable: false` — the SB 261 distinction made
   * explicit (ADR-0006).
   */
  readonly enforceable: boolean;
  /** The first reporting deadline carried through when the obligation applies. */
  readonly dueBy?: string;
}

const usd = (n: number): string => `$${n.toLocaleString("en-US")}`;

/**
 * Evaluate one obligation against one profile. Pure: no I/O, deterministic,
 * and it records a reason for every criterion it checks so the determination is
 * auditable.
 */
export function evaluateObligation(
  profile: CompanyProfile,
  obligation: Obligation,
): ApplicabilityResult {
  const { criteria } = obligation;
  const reasons: string[] = [];
  let applies = true;

  if (criteria.minTotalAnnualRevenueUSD !== undefined) {
    const meets =
      profile.totalAnnualRevenueUSD >= criteria.minTotalAnnualRevenueUSD;
    applies &&= meets;
    reasons.push(
      `revenue ${usd(profile.totalAnnualRevenueUSD)} ${meets ? "≥" : "<"} ` +
        `threshold ${usd(criteria.minTotalAnnualRevenueUSD)}`,
    );
  }

  if (criteria.operatesInAnyOf !== undefined) {
    const matched = criteria.operatesInAnyOf.filter((j) =>
      profile.jurisdictions.includes(j),
    );
    const meets = matched.length > 0;
    applies &&= meets;
    reasons.push(
      meets
        ? `operates in ${matched.join(", ")}`
        : `operates in none of ${criteria.operatesInAnyOf.join(", ")}`,
    );
  }

  if (criteria.listingStatusIn !== undefined) {
    const meets = criteria.listingStatusIn.includes(profile.listingStatus);
    applies &&= meets;
    reasons.push(
      `listing status "${profile.listingStatus}" ${meets ? "is" : "is not"} ` +
        `one of ${criteria.listingStatusIn.join(", ")}`,
    );
  }

  if (criteria.excludedIfListingStatusIn !== undefined) {
    const excluded = criteria.excludedIfListingStatusIn.includes(
      profile.listingStatus,
    );
    if (excluded) {
      applies = false;
      reasons.push(
        `excluded: listing status "${profile.listingStatus}" is carved out`,
      );
    }
  }

  const enforceable = applies && isCurrentlyEnforced(obligation.status);

  const result: ApplicabilityResult = {
    obligation,
    applies,
    reasons,
    enforceable,
    ...(applies && obligation.firstReportingDeadline !== undefined
      ? { dueBy: obligation.firstReportingDeadline }
      : {}),
  };
  return result;
}

/**
 * Evaluate a profile against a set of obligations. Returns a result for every
 * obligation (including non-matches), so callers can show "checked but does not
 * apply" rather than silently dropping it.
 */
export function evaluateApplicability(
  profile: CompanyProfile,
  obligations: readonly Obligation[],
): ApplicabilityResult[] {
  return obligations.map((o) => evaluateObligation(profile, o));
}

/** Convenience: only the obligations that apply (regardless of enforcement). */
export function applicableObligations(
  profile: CompanyProfile,
  obligations: readonly Obligation[],
): ApplicabilityResult[] {
  return evaluateApplicability(profile, obligations).filter((r) => r.applies);
}

export { isLaw };
