/**
 * View-model derivation for the static site (ADR-0013).
 *
 * Pure, dependency-free transforms from the `@sust-reg/core` domain types into
 * display-ready shapes. Rendering (render.ts) stays "dumb": every human-readable
 * string and every applies/grounded flag is computed here, so the markup layer
 * only escapes and arranges already-decided facts.
 *
 * Scope discipline (ADR-0002): the descriptions produced here are plain,
 * threshold-derived facts — "applies at revenue ≥ $X" — never advice about what
 * to do. Citation grounding (ADR-0004) is surfaced as an explicit flag so
 * ungrounded seed data is visibly distinguishable from grounded fact.
 */
import {
  type ApplicabilityCriteria,
  type Obligation,
  type RegulationStatus,
  type SourceCitation,
  isCurrentlyEnforced,
  isGrounded,
  isLaw,
} from "@sust-reg/core";

/** Human-facing label for each explicit status state (ADR-0006). */
const STATUS_LABELS: Record<RegulationStatus, string> = {
  proposed: "Proposed",
  "in-effect": "In effect",
  enforced: "Enforced",
  stayed: "Stayed",
};

/**
 * One-line factual description of each status. Descriptive, not advisory: it
 * states what the lifecycle state means, including the SB 261 "law but
 * enforcement paused" distinction (ADR-0006).
 */
const STATUS_DESCRIPTIONS: Record<RegulationStatus, string> = {
  proposed: "Not yet law — proposed and open for comment.",
  "in-effect": "Legally in force.",
  enforced: "In force and actively enforced.",
  stayed: "In force, but enforcement is currently paused.",
};

export function statusLabel(status: RegulationStatus): string {
  return STATUS_LABELS[status];
}

export function statusDescription(status: RegulationStatus): string {
  return STATUS_DESCRIPTIONS[status];
}

/** Format a USD amount the same way the applicability engine does. */
export function formatUsd(amount: number): string {
  return `$${amount.toLocaleString("en-US")}`;
}

/**
 * Translate the applicability criteria into a list of plain-fact sentences —
 * one per constrained axis. An omitted axis is "no constraint" and produces no
 * sentence; if nothing is constrained at all, a single explicit sentence says
 * so rather than rendering an empty list.
 */
export function criteriaFacts(criteria: ApplicabilityCriteria): string[] {
  const facts: string[] = [];

  if (criteria.minTotalAnnualRevenueUSD !== undefined) {
    facts.push(
      `Applies at total annual revenue ≥ ${formatUsd(criteria.minTotalAnnualRevenueUSD)}.`,
    );
  }

  if (criteria.operatesInAnyOf !== undefined) {
    facts.push(
      `Applies to entities operating in any of: ${criteria.operatesInAnyOf.join(", ")}.`,
    );
  }

  if (criteria.listingStatusIn !== undefined) {
    facts.push(
      `Applies to listing status: ${criteria.listingStatusIn.join(", ")}.`,
    );
  }

  if (
    criteria.excludedIfListingStatusIn !== undefined &&
    criteria.excludedIfListingStatusIn.length > 0
  ) {
    facts.push(
      `Carve-out: does not apply to listing status: ${criteria.excludedIfListingStatusIn.join(", ")}.`,
    );
  }

  if (facts.length === 0) {
    facts.push("Applies to all entities in scope (no additional thresholds).");
  }

  return facts;
}

/** Root-relative URL of an obligation's detail page. */
export function obligationHref(id: string): string {
  return `/regimes/${id}.html`;
}

export interface CitationView {
  readonly label: string;
  readonly grounded: boolean;
  readonly sourceUrl?: string;
  readonly retrievedAt?: string;
}

export function citationView(citation: SourceCitation): CitationView {
  return {
    label: citation.label,
    grounded: isGrounded(citation),
    ...(citation.sourceUrl !== undefined
      ? { sourceUrl: citation.sourceUrl }
      : {}),
    ...(citation.retrievedAt !== undefined
      ? { retrievedAt: citation.retrievedAt }
      : {}),
  };
}

export interface ObligationView {
  readonly id: string;
  readonly regime: string;
  readonly title: string;
  readonly status: RegulationStatus;
  readonly statusLabel: string;
  readonly statusDescription: string;
  readonly isLaw: boolean;
  readonly isEnforced: boolean;
  readonly criteriaFacts: readonly string[];
  readonly firstReportingDeadline?: string;
  readonly citation: CitationView;
  readonly href: string;
}

export function obligationView(obligation: Obligation): ObligationView {
  return {
    id: obligation.id,
    regime: obligation.regime,
    title: obligation.title,
    status: obligation.status,
    statusLabel: statusLabel(obligation.status),
    statusDescription: statusDescription(obligation.status),
    isLaw: isLaw(obligation.status),
    isEnforced: isCurrentlyEnforced(obligation.status),
    criteriaFacts: criteriaFacts(obligation.criteria),
    ...(obligation.firstReportingDeadline !== undefined
      ? { firstReportingDeadline: obligation.firstReportingDeadline }
      : {}),
    citation: citationView(obligation.source),
    href: obligationHref(obligation.id),
  };
}

export interface RegimeGroup {
  readonly regime: string;
  readonly obligations: readonly ObligationView[];
}

/**
 * Group obligation views by regime, preserving first-seen order of both regimes
 * and obligations so output is deterministic (a build-reproducibility concern).
 */
export function regimeGroups(
  obligations: readonly Obligation[],
): RegimeGroup[] {
  const groups = new Map<string, ObligationView[]>();
  for (const obligation of obligations) {
    const view = obligationView(obligation);
    const existing = groups.get(view.regime);
    if (existing === undefined) {
      groups.set(view.regime, [view]);
    } else {
      existing.push(view);
    }
  }
  return [...groups].map(([regime, views]) => ({
    regime,
    obligations: views,
  }));
}
