/**
 * Explicit regulation status states (ADR-0006).
 *
 * Regulation status is NOT a boolean. A rule can be on the books while its
 * enforcement is paused — the SB 261 "law-but-enforcement-stayed" case — and a
 * tool that collapses this into active/inactive gets it catastrophically
 * wrong. The status drives, but never replaces, the factual output of the
 * applicability engine: we report what the status is, we do not advise.
 */
export const REGULATION_STATUSES = [
  /** Not yet law (e.g. a proposed rule open for comment). */
  "proposed",
  /** Legally in force. */
  "in-effect",
  /** In force AND actively enforced. */
  "enforced",
  /** In force but enforcement is paused (e.g. pending appeal). */
  "stayed",
] as const;

export type RegulationStatus = (typeof REGULATION_STATUSES)[number];

export function isRegulationStatus(value: unknown): value is RegulationStatus {
  return (
    typeof value === "string" &&
    (REGULATION_STATUSES as readonly string[]).includes(value)
  );
}

/**
 * Is the rule on the books (a binding legal obligation exists), regardless of
 * whether enforcement is currently active? True for in-effect, enforced, and
 * stayed; false for proposed.
 */
export function isLaw(status: RegulationStatus): boolean {
  return status === "in-effect" || status === "enforced" || status === "stayed";
}

/**
 * Is enforcement currently active? Only `enforced`. A `stayed` rule is law but
 * its enforcement is paused; an `in-effect` rule is in force but this models
 * the case where active enforcement has not yet begun.
 */
export function isCurrentlyEnforced(status: RegulationStatus): boolean {
  return status === "enforced";
}
