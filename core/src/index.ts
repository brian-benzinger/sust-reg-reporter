/**
 * @sust-reg/core — pure, dependency-free domain logic shared across the
 * ingest, api, and web workspaces (ADR-0018). No I/O, no AWS, no framework.
 */
export * from "./status.ts";
export * from "./citation.ts";
export * from "./applicability.ts";
export * as caRegime from "./regimes/ca-sb253-261.ts";
