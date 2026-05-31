import { describe, it, expect } from "vitest";
import {
  type Obligation,
  UNGROUNDED_SNAPSHOT_HASH,
} from "@sust-reg/core";
import {
  citationView,
  criteriaFacts,
  formatUsd,
  obligationHref,
  obligationView,
  regimeGroups,
  statusDescription,
  statusLabel,
} from "../src/model.ts";

describe("status labelling (ADR-0006)", () => {
  it("labels every explicit status state", () => {
    expect(statusLabel("proposed")).toBe("Proposed");
    expect(statusLabel("in-effect")).toBe("In effect");
    expect(statusLabel("enforced")).toBe("Enforced");
    expect(statusLabel("stayed")).toBe("Stayed");
  });

  it("describes the stayed state as paused enforcement", () => {
    expect(statusDescription("stayed")).toMatch(/paused/i);
    expect(statusDescription("proposed")).toMatch(/not yet law/i);
    expect(statusDescription("in-effect")).toMatch(/in force/i);
    expect(statusDescription("enforced")).toMatch(/actively enforced/i);
  });
});

describe("formatUsd", () => {
  it("formats with thousands separators", () => {
    expect(formatUsd(500_000_000)).toBe("$500,000,000");
  });
});

describe("criteriaFacts (ADR-0005, ADR-0002)", () => {
  it("renders one plain fact per constrained axis", () => {
    const facts = criteriaFacts({
      minTotalAnnualRevenueUSD: 1_000_000_000,
      operatesInAnyOf: ["US-CA"],
      listingStatusIn: ["public-us", "public-eu"],
      excludedIfListingStatusIn: ["private"],
    });
    expect(facts).toEqual([
      "Applies at total annual revenue ≥ $1,000,000,000.",
      "Applies to entities operating in any of: US-CA.",
      "Applies to listing status: public-us, public-eu.",
      "Carve-out: does not apply to listing status: private.",
    ]);
  });

  it("omits an empty carve-out list (the SB 261 shape)", () => {
    const facts = criteriaFacts({
      minTotalAnnualRevenueUSD: 500_000_000,
      operatesInAnyOf: ["US-CA"],
      excludedIfListingStatusIn: [],
    });
    expect(facts).toHaveLength(2);
    expect(facts.some((f) => f.includes("Carve-out"))).toBe(false);
  });

  it("states explicitly when nothing is constrained", () => {
    expect(criteriaFacts({})).toEqual([
      "Applies to all entities in scope (no additional thresholds).",
    ]);
  });
});

describe("citationView (ADR-0004)", () => {
  it("flags grounded citations and carries optional provenance", () => {
    const view = citationView({
      label: "Real source § 1",
      snapshotHash: "sha256:abc123",
      sourceUrl: "https://example.gov/source",
      retrievedAt: "2026-05-01",
    });
    expect(view).toEqual({
      label: "Real source § 1",
      grounded: true,
      sourceUrl: "https://example.gov/source",
      retrievedAt: "2026-05-01",
    });
  });

  it("flags ungrounded seed data and omits absent provenance", () => {
    const view = citationView({
      label: "Seed",
      snapshotHash: UNGROUNDED_SNAPSHOT_HASH,
    });
    expect(view.grounded).toBe(false);
    expect(view.sourceUrl).toBeUndefined();
    expect(view.retrievedAt).toBeUndefined();
  });
});

const baseObligation: Obligation = {
  id: "demo-obligation",
  regime: "DEMO",
  title: "Demo obligation",
  status: "enforced",
  criteria: { minTotalAnnualRevenueUSD: 100 },
  firstReportingDeadline: "2027-01-01",
  source: { label: "Demo source", snapshotHash: "sha256:demo" },
};

describe("obligationView", () => {
  it("derives all display fields, including a deadline when present", () => {
    const view = obligationView(baseObligation);
    expect(view.statusLabel).toBe("Enforced");
    expect(view.isLaw).toBe(true);
    expect(view.isEnforced).toBe(true);
    expect(view.href).toBe("/regimes/demo-obligation.html");
    expect(view.firstReportingDeadline).toBe("2027-01-01");
    expect(view.citation.grounded).toBe(true);
  });

  it("omits the deadline when the obligation has none", () => {
    const { firstReportingDeadline, ...rest } = baseObligation;
    void firstReportingDeadline;
    const view = obligationView(rest);
    expect(view.firstReportingDeadline).toBeUndefined();
  });
});

describe("obligationHref", () => {
  it("builds a root-relative detail path", () => {
    expect(obligationHref("ca-sb261")).toBe("/regimes/ca-sb261.html");
  });
});

describe("regimeGroups", () => {
  it("groups by regime preserving first-seen order", () => {
    const groups = regimeGroups([
      { ...baseObligation, id: "a", regime: "R1" },
      { ...baseObligation, id: "b", regime: "R2" },
      { ...baseObligation, id: "c", regime: "R1" },
    ]);
    expect(groups.map((g) => g.regime)).toEqual(["R1", "R2"]);
    expect(groups[0]?.obligations.map((o) => o.id)).toEqual(["a", "c"]);
    expect(groups[1]?.obligations.map((o) => o.id)).toEqual(["b"]);
  });
});
