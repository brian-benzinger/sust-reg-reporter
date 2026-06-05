/**
 * EU CSRD / ESRS obligations — seed data (part of v1 scope, ADR-0009).
 *
 * ⚠️ Illustrative, UNGROUNDED seed data (ADR-0002, ADR-0004). It models the
 * SHAPE of the CSRD regime to exercise the applicability engine and the as-of
 * slider — it is NOT a legal assertion about who must report or when. Every
 * citation carries the ungrounded sentinel until pinned to a real EUR-Lex
 * snapshot (ADR-0008).
 *
 * Modeled facts (subject to grounding):
 *  - CSRD (Directive 2022/2464) requires in-scope companies to report under the
 *    ESRS on a DOUBLE-MATERIALITY basis, phased in by "waves".
 *  - Wave 1: large EU public-interest entities, first reporting on FY2024 in
 *    2025 — already in effect.
 *  - The 2025 "Omnibus" simplification ("stop-the-clock") raised thresholds and
 *    DELAYED later waves by ~2 years. This is the EU regime's bitemporal
 *    showcase: a later wave once recorded as scheduled-in-effect is reverted to
 *    proposed for the same valid period once the clock stops — the same valid
 *    date reads differently depending on the knowledge date.
 */
import type { Obligation } from "../applicability.ts";
import { UNGROUNDED_SNAPSHOT_HASH } from "../citation.ts";
import type { RegulationStatus } from "../status.ts";
import type { TemporalFact } from "../temporal.ts";
import type { ObligationStatusHistory } from "./status-history.ts";

export const CSRD_WAVE1: Obligation = {
  id: "eu-csrd-esrs-wave1",
  regime: "EU-CSRD",
  title: "ESRS sustainability statement (wave 1: large PIEs)",
  status: "in-effect",
  criteria: {
    operatesInAnyOf: ["EU"],
    listingStatusIn: ["public-eu"],
  },
  firstReportingDeadline: "2025-01-01",
  source: {
    label: "EU CSRD / ESRS (Directive 2022/2464)",
    snapshotHash: UNGROUNDED_SNAPSHOT_HASH,
  },
  sourceKey: "eu-csrd-2022-2464",
};

export const CSRD_WAVE2: Obligation = {
  id: "eu-csrd-esrs-wave2",
  regime: "EU-CSRD",
  title: "ESRS sustainability statement (wave 2: other large companies)",
  // Post-Omnibus the start of this wave was pushed back; modeled as proposed
  // (delayed), the "stop-the-clock" outcome.
  status: "proposed",
  criteria: {
    operatesInAnyOf: ["EU"],
    listingStatusIn: ["public-eu", "private"],
  },
  firstReportingDeadline: "2028-01-01",
  source: {
    label: "EU CSRD wave 2 (post-Omnibus stop-the-clock)",
    snapshotHash: UNGROUNDED_SNAPSHOT_HASH,
  },
  // Both waves are substantiated by the same CSRD directive snapshot (ADR-0028:
  // one source may ground several obligations).
  sourceKey: "eu-csrd-2022-2464",
};

/** All seeded EU CSRD obligations. */
export const EU_OBLIGATIONS: readonly Obligation[] = [CSRD_WAVE1, CSRD_WAVE2];

export const CSRD_WAVE1_STATUS_HISTORY: readonly TemporalFact<RegulationStatus>[] =
  [
    {
      value: "proposed",
      validFrom: "2021-04-21",
      validTo: "2024-01-01",
      recordedAt: "2021-04-21",
    },
    { value: "in-effect", validFrom: "2024-01-01", recordedAt: "2023-01-05" },
  ];

/**
 * The Omnibus showcase: wave 2 was recorded as scheduled-in-effect from 2026,
 * then the 2025 "stop-the-clock" reverted it to proposed for that same period.
 * So validOn 2026-06-01 resolves to "in-effect" as known in 2024, but to
 * "proposed" as known in 2025.
 */
export const CSRD_WAVE2_STATUS_HISTORY: readonly TemporalFact<RegulationStatus>[] =
  [
    {
      value: "proposed",
      validFrom: "2021-04-21",
      validTo: "2026-01-01",
      recordedAt: "2021-04-21",
    },
    { value: "in-effect", validFrom: "2026-01-01", recordedAt: "2023-01-05" },
    // Recorded 2025: the Omnibus "stop-the-clock" delay reverts the same period.
    { value: "proposed", validFrom: "2026-01-01", recordedAt: "2025-04-16" },
  ];

export const EU_STATUS_HISTORIES: readonly ObligationStatusHistory[] = [
  {
    obligationId: CSRD_WAVE1.id,
    title: CSRD_WAVE1.title,
    regime: CSRD_WAVE1.regime,
    history: CSRD_WAVE1_STATUS_HISTORY,
  },
  {
    obligationId: CSRD_WAVE2.id,
    title: CSRD_WAVE2.title,
    regime: CSRD_WAVE2.regime,
    history: CSRD_WAVE2_STATUS_HISTORY,
  },
];
