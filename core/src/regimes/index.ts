/**
 * The v1 corpus (ADR-0009): the regimes' obligations and bitemporal status
 * histories, aggregated so consumers (the site, the corpus seeder, the scope
 * checker) draw from one place instead of hard-coding a single regime.
 *
 * ISSB (IFRS S1/S2) is intentionally absent: its standards text is IFRS
 * copyright and cannot be ingested, stored, or served without a licence we do
 * not hold, so it is deferred from v1 (ADR-0027). The remaining regimes use
 * public-domain government primary sources.
 */
import type { Obligation } from "../applicability.ts";
import type { ObligationStatusHistory } from "./status-history.ts";
import {
  CALIFORNIA_OBLIGATIONS,
  CALIFORNIA_STATUS_HISTORIES,
} from "./ca-sb253-261.ts";
import { EU_OBLIGATIONS, EU_STATUS_HISTORIES } from "./eu-csrd.ts";

/** Every modeled obligation across the v1 regimes, in regime order. */
export const ALL_OBLIGATIONS: readonly Obligation[] = [
  ...CALIFORNIA_OBLIGATIONS,
  ...EU_OBLIGATIONS,
];

/** Every obligation's bitemporal status history across the v1 regimes. */
export const ALL_STATUS_HISTORIES: readonly ObligationStatusHistory[] = [
  ...CALIFORNIA_STATUS_HISTORIES,
  ...EU_STATUS_HISTORIES,
];
