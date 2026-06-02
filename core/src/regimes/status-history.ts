/**
 * The shape of a single obligation's bitemporal status timeline (ADR-0003),
 * shared by every regime module and the as-of slider. Kept in its own neutral
 * module so no regime has to import a type from a sibling regime.
 */
import type { RegulationStatus } from "../status.ts";
import type { TemporalFact } from "../temporal.ts";

/** A regime's status timeline, tied to the obligation it tracks. */
export interface ObligationStatusHistory {
  readonly obligationId: string;
  readonly title: string;
  readonly regime: string;
  readonly history: readonly TemporalFact<RegulationStatus>[];
}
