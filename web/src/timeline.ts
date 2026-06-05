/**
 * As-of-date slider view model (ADR-0003 made visible).
 *
 * Pure, DOM-free transforms over the bitemporal status histories: collect the
 * candidate slider dates, and resolve every obligation's status for a given
 * (valid date, knowledge date) pair using the shared `core` resolver. The React
 * slider (AsOfSlider.tsx) is a thin shell over these functions.
 */
import {
  type AsOf,
  type GroundingConfidence,
  type ObligationStatusHistory,
  type RegulationStatus,
  resolveValueAsOf,
} from "@sust-reg/core";
import { statusLabel } from "./model.ts";

export interface SliderDates {
  /** Distinct valid-time boundary dates, ascending. */
  readonly validDates: readonly string[];
  /** Distinct transaction-time (recorded) dates, ascending. */
  readonly knowledgeDates: readonly string[];
}

/** Gather the distinct boundary dates that make meaningful slider stops. */
export function collectDates(
  histories: readonly ObligationStatusHistory[],
): SliderDates {
  const valid = new Set<string>();
  const knowledge = new Set<string>();
  for (const { history } of histories) {
    for (const fact of history) {
      valid.add(fact.validFrom);
      if (fact.validTo !== undefined) {
        valid.add(fact.validTo);
      }
      knowledge.add(fact.recordedAt);
    }
  }
  return {
    validDates: [...valid].sort(),
    knowledgeDates: [...knowledge].sort(),
  };
}

export interface TimelineRow {
  readonly obligationId: string;
  readonly title: string;
  readonly regime: string;
  readonly status?: RegulationStatus;
  /** Display label, or an em dash when nothing was known/valid at that point. */
  readonly label: string;
  /**
   * Whether the obligation is grounded in a real snapshot (ADR-0028). Undefined
   * until the API answers — the seed/initial-paint rows carry no grounding, so
   * the column stays neutral rather than flashing a misleading "ungrounded".
   */
  readonly grounded?: boolean;
  readonly confidence?: GroundingConfidence;
  /** Snapshot provenance for the grounding tooltip; present when grounded. */
  readonly snapshotHash?: string;
  readonly retrievedAt?: string;
}

/** Resolve every obligation's status for a bitemporal query. */
export function resolveRows(
  histories: readonly ObligationStatusHistory[],
  asOf: AsOf,
): TimelineRow[] {
  return histories.map((entry) => {
    const status = resolveValueAsOf(entry.history, asOf);
    return {
      obligationId: entry.obligationId,
      title: entry.title,
      regime: entry.regime,
      ...(status !== undefined ? { status } : {}),
      label: status !== undefined ? statusLabel(status) : "n/a",
    };
  });
}
