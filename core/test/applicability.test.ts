import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  applicableObligations,
  evaluateApplicability,
  evaluateObligation,
  type CompanyProfile,
  type Obligation,
} from "../src/applicability.ts";
import { UNGROUNDED_SNAPSHOT_HASH } from "../src/citation.ts";
import { CALIFORNIA_OBLIGATIONS, SB_261 } from "../src/regimes/ca-sb253-261.ts";

const profile = (overrides: Partial<CompanyProfile> = {}): CompanyProfile => ({
  totalAnnualRevenueUSD: 600_000_000,
  jurisdictions: ["US-CA", "US"],
  listingStatus: "private",
  fiscalYearEnd: "12-31",
  ...overrides,
});

describe("applicability engine (ADR-0005)", () => {
  it("applies SB 261 ($500M) but not SB 253 ($1B) at $600M revenue in CA", () => {
    const results = evaluateApplicability(profile(), CALIFORNIA_OBLIGATIONS);
    const byId = new Map(results.map((r) => [r.obligation.id, r]));

    assert.equal(byId.get("ca-sb261-climate-risk-report")?.applies, true);
    assert.equal(byId.get("ca-sb253-ghg-disclosure")?.applies, false);
  });

  it("applies both regimes above the $1B threshold", () => {
    const applicable = applicableObligations(
      profile({ totalAnnualRevenueUSD: 2_000_000_000 }),
      CALIFORNIA_OBLIGATIONS,
    );
    assert.deepEqual(
      applicable.map((r) => r.obligation.id).sort(),
      ["ca-sb253-ghg-disclosure", "ca-sb261-climate-risk-report"],
    );
  });

  it("does not apply when the company does not operate in California", () => {
    const applicable = applicableObligations(
      profile({ jurisdictions: ["US", "EU"] }),
      CALIFORNIA_OBLIGATIONS,
    );
    assert.equal(applicable.length, 0);
  });

  it("carries the first reporting deadline through when it applies", () => {
    const result = evaluateObligation(profile(), SB_261);
    assert.equal(result.dueBy, "2026-01-01");
  });

  it("omits the deadline when the obligation does not apply", () => {
    const result = evaluateObligation(
      profile({ totalAnnualRevenueUSD: 100_000_000 }),
      SB_261,
    );
    assert.equal(result.applies, false);
    assert.equal(result.dueBy, undefined);
  });

  it("records a factual reason for every criterion checked", () => {
    const result = evaluateObligation(profile(), SB_261);
    assert.ok(
      result.reasons.some((r) => r.includes("≥")),
      "expected a revenue comparison reason",
    );
    assert.ok(
      result.reasons.some((r) => r.includes("US-CA")),
      "expected a jurisdiction reason",
    );
  });

  describe("the SB 261 stayed-enforcement distinction (ADR-0006)", () => {
    const stayed: Obligation = { ...SB_261, status: "stayed" };
    const enforced: Obligation = { ...SB_261, status: "enforced" };

    it("a stayed obligation still applies but is not enforceable", () => {
      const result = evaluateObligation(profile(), stayed);
      assert.equal(result.applies, true);
      assert.equal(result.enforceable, false);
    });

    it("an enforced obligation that applies is enforceable", () => {
      const result = evaluateObligation(profile(), enforced);
      assert.equal(result.applies, true);
      assert.equal(result.enforceable, true);
    });

    it("a stayed obligation that does NOT apply is not enforceable", () => {
      const result = evaluateObligation(
        profile({ jurisdictions: ["EU"] }),
        stayed,
      );
      assert.equal(result.applies, false);
      assert.equal(result.enforceable, false);
    });
  });

  it("seed obligations are flagged ungrounded until pinned to a snapshot", () => {
    for (const o of CALIFORNIA_OBLIGATIONS) {
      assert.equal(o.source.snapshotHash, UNGROUNDED_SNAPSHOT_HASH);
    }
  });
});
