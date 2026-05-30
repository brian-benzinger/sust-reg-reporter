/**
 * California SB 253 / SB 261 obligations — seed data (part of v1 scope,
 * ADR-0009).
 *
 * ⚠️ This is illustrative seed data, NOT a grounded source of fact. The
 * thresholds and dates below model the regimes for exercising the applicability
 * engine and tests. Every obligation here carries an UNGROUNDED citation
 * (ADR-0004); before any of this is served to a user it must be replaced with a
 * span pinned to a real ingested snapshot. This is also why status values here
 * are conservative placeholders, not legal assertions about the current state
 * of the law.
 *
 * Modeled facts (subject to grounding):
 *  - SB 253 (Climate Corporate Data Accountability Act): entities doing
 *    business in California with total annual revenue over $1B; GHG emissions
 *    disclosure.
 *  - SB 261 (Climate-Related Financial Risk Act): entities doing business in
 *    California with total annual revenue over $500M; biennial climate-related
 *    financial risk report. Insurance companies are carved out. This is the
 *    canonical "law while enforcement was paused" example (ADR-0006).
 */
import type { Obligation } from "../applicability.ts";
import { UNGROUNDED_SNAPSHOT_HASH } from "../citation.ts";

export const SB_253: Obligation = {
  id: "ca-sb253-ghg-disclosure",
  regime: "CA-SB253",
  title: "GHG emissions disclosure (Scope 1 & 2)",
  status: "in-effect",
  criteria: {
    minTotalAnnualRevenueUSD: 1_000_000_000,
    operatesInAnyOf: ["US-CA"],
  },
  firstReportingDeadline: "2026-01-01",
  source: {
    label: "California SB 253 (2023) — seed, ungrounded",
    snapshotHash: UNGROUNDED_SNAPSHOT_HASH,
  },
};

export const SB_261: Obligation = {
  id: "ca-sb261-climate-risk-report",
  regime: "CA-SB261",
  title: "Climate-related financial risk report",
  // Modeled as in-effect (on the books). The engine demonstrates that flipping
  // this to "stayed" keeps `applies: true` while making `enforceable: false`.
  status: "in-effect",
  criteria: {
    minTotalAnnualRevenueUSD: 500_000_000,
    operatesInAnyOf: ["US-CA"],
    excludedIfListingStatusIn: [],
  },
  firstReportingDeadline: "2026-01-01",
  source: {
    label: "California SB 261 (2023) — seed, ungrounded",
    snapshotHash: UNGROUNDED_SNAPSHOT_HASH,
  },
};

/** All seeded California obligations. */
export const CALIFORNIA_OBLIGATIONS: readonly Obligation[] = [SB_253, SB_261];
