/**
 * @sust-reg/core — pure, dependency-free domain logic shared across the
 * ingest, api, and web workspaces (ADR-0018). No I/O, no AWS, no framework.
 */
export * from "./status.ts";
export * from "./citation.ts";
export * from "./applicability.ts";
export * from "./temporal.ts";
export * from "./grounding.ts";
export * from "./span.ts";
export type { ObligationStatusHistory } from "./regimes/status-history.ts";
export * as caRegime from "./regimes/ca-sb253-261.ts";
export * as euRegime from "./regimes/eu-csrd.ts";
// ISSB (IFRS S1/S2) deferred from v1 pending an IFRS licence (ADR-0027).
export { ALL_OBLIGATIONS, ALL_STATUS_HISTORIES } from "./regimes/index.ts";
