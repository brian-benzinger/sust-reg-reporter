/**
 * ISSB IFRS S1 / S2 obligations — seed data (part of v1 scope, ADR-0009).
 *
 * ⚠️ Illustrative, UNGROUNDED seed data (ADR-0002, ADR-0004) — the SHAPE of the
 * regime for exercising the engine and slider, not a legal assertion.
 *
 * Modeled facts (subject to grounding):
 *  - IFRS S1 (general sustainability) and S2 (climate) were issued by the ISSB
 *    in June 2023 as a global BASELINE. A baseline standard is not itself law:
 *    it becomes binding only where a jurisdiction ADOPTS it. So these are
 *    modeled `proposed` on issue, then `in-effect` once early adopters bring
 *    them into force — the regime's "spreading adoption" trajectory, the
 *    opposite direction of the EU pullback.
 *  - The S1/S2 source text is published by the IFRS Foundation under copyright;
 *    unlike the public-domain statutes, grounding and redistribution need a
 *    licensing decision before a fetch adapter is enabled (see sources.ts).
 */
import type { Obligation } from "../applicability.ts";
import { UNGROUNDED_SNAPSHOT_HASH } from "../citation.ts";
import type { RegulationStatus } from "../status.ts";
import type { TemporalFact } from "../temporal.ts";
import type { ObligationStatusHistory } from "./status-history.ts";

export const ISSB_S2: Obligation = {
  id: "issb-s2-climate",
  regime: "ISSB-S2",
  title: "IFRS S2 climate-related disclosures",
  // A baseline standard, binding only where adopted; modeled `proposed` until
  // early jurisdictions bring it into force.
  status: "proposed",
  criteria: {
    operatesInAnyOf: ["GB", "AU", "JP", "BR"],
    listingStatusIn: ["public-other"],
  },
  firstReportingDeadline: "2025-01-01",
  source: {
    label: "IFRS S2 (ISSB, 2023) — seed, ungrounded",
    snapshotHash: UNGROUNDED_SNAPSHOT_HASH,
  },
};

export const ISSB_S1: Obligation = {
  id: "issb-s1-general",
  regime: "ISSB-S1",
  title: "IFRS S1 general sustainability-related disclosures",
  status: "proposed",
  criteria: {
    operatesInAnyOf: ["GB", "AU", "JP", "BR"],
    listingStatusIn: ["public-other"],
  },
  firstReportingDeadline: "2025-01-01",
  source: {
    label: "IFRS S1 (ISSB, 2023) — seed, ungrounded",
    snapshotHash: UNGROUNDED_SNAPSHOT_HASH,
  },
};

/** All seeded ISSB obligations. */
export const ISSB_OBLIGATIONS: readonly Obligation[] = [ISSB_S2, ISSB_S1];

/**
 * The adoption showcase: issued as a baseline (`proposed`) on 2023-06-26, then
 * brought into force by early adopters (`in-effect` from 2024-01-01, but only
 * recorded once adoption was announced in mid-2024). So validOn 2024-03-01
 * reads "proposed" as known in early 2024, but "in-effect" as known later.
 */
export const ISSB_S2_STATUS_HISTORY: readonly TemporalFact<RegulationStatus>[] = [
  { value: "proposed", validFrom: "2023-06-26", recordedAt: "2023-06-26" },
  { value: "in-effect", validFrom: "2024-01-01", recordedAt: "2024-06-01" },
];

export const ISSB_S1_STATUS_HISTORY: readonly TemporalFact<RegulationStatus>[] = [
  { value: "proposed", validFrom: "2023-06-26", recordedAt: "2023-06-26" },
];

export const ISSB_STATUS_HISTORIES: readonly ObligationStatusHistory[] = [
  {
    obligationId: ISSB_S2.id,
    title: ISSB_S2.title,
    regime: ISSB_S2.regime,
    history: ISSB_S2_STATUS_HISTORY,
  },
  {
    obligationId: ISSB_S1.id,
    title: ISSB_S1.title,
    regime: ISSB_S1.regime,
    history: ISSB_S1_STATUS_HISTORY,
  },
];
