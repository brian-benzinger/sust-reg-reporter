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
import type { RegulationStatus } from "../status.ts";
import type { TemporalFact } from "../temporal.ts";

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

/**
 * ⚠️ Illustrative, ungrounded bitemporal status histories (ADR-0003) — seed
 * data for exercising the as-of-date slider, NOT legal assertions about the
 * actual timeline. The dates model the *shape* of the SB 261 story, not its
 * precise record.
 *
 * SB 261's history is deliberately the bitemporal showcase: a later recording
 * (the enforcement stay, recorded in 2025) corrects what we believed about a
 * valid period without erasing the earlier "in-effect" belief. So the same
 * valid date resolves to "in-effect" as known in mid-2024, but to "stayed" as
 * known in 2025 — exactly the distinction the slider exists to make visible.
 */
export const SB_253_STATUS_HISTORY: readonly TemporalFact<RegulationStatus>[] = [
  {
    value: "proposed",
    validFrom: "2023-01-01",
    validTo: "2023-10-07",
    recordedAt: "2023-02-01",
  },
  { value: "in-effect", validFrom: "2023-10-07", recordedAt: "2023-10-10" },
];

export const SB_261_STATUS_HISTORY: readonly TemporalFact<RegulationStatus>[] = [
  {
    value: "proposed",
    validFrom: "2023-01-01",
    validTo: "2023-10-07",
    recordedAt: "2023-02-01",
  },
  { value: "in-effect", validFrom: "2023-10-07", recordedAt: "2023-10-10" },
  // Recorded in 2025: enforcement was stayed, effective back to 2024-12-01.
  { value: "stayed", validFrom: "2024-12-01", recordedAt: "2025-01-15" },
];

/** A regime's status timeline, tied to the obligation it tracks. */
export interface ObligationStatusHistory {
  readonly obligationId: string;
  readonly title: string;
  readonly regime: string;
  readonly history: readonly TemporalFact<RegulationStatus>[];
}

export const CALIFORNIA_STATUS_HISTORIES: readonly ObligationStatusHistory[] = [
  {
    obligationId: SB_253.id,
    title: SB_253.title,
    regime: SB_253.regime,
    history: SB_253_STATUS_HISTORY,
  },
  {
    obligationId: SB_261.id,
    title: SB_261.title,
    regime: SB_261.regime,
    history: SB_261_STATUS_HISTORY,
  },
];
