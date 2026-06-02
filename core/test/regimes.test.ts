import { describe, it, expect } from "vitest";
import {
  ALL_OBLIGATIONS,
  ALL_STATUS_HISTORIES,
  isGrounded,
  isRegulationStatus,
  resolveValueAsOf,
} from "@sust-reg/core";

describe("v1 corpus aggregate (ADR-0009, ADR-0027)", () => {
  it("spans the public-source v1 regimes with unique obligation ids", () => {
    const regimes = new Set(ALL_OBLIGATIONS.map((o) => o.regime));
    expect(regimes).toContain("CA-SB261");
    expect([...regimes].some((r) => r.startsWith("EU-CSRD"))).toBe(true);
    // ISSB is deferred pending an IFRS licence (ADR-0027).
    expect([...regimes].some((r) => r.startsWith("ISSB"))).toBe(false);

    const ids = ALL_OBLIGATIONS.map((o) => o.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("carries a valid status and an ungrounded seed citation on every obligation", () => {
    for (const o of ALL_OBLIGATIONS) {
      expect(isRegulationStatus(o.status)).toBe(true);
      // Seed data is deliberately ungrounded until pinned to a real snapshot.
      expect(isGrounded(o.source)).toBe(false);
    }
  });

  it("pairs every status history with a real obligation and ISO dates", () => {
    const ids = new Set(ALL_OBLIGATIONS.map((o) => o.id));
    expect(ALL_STATUS_HISTORIES.length).toBe(ALL_OBLIGATIONS.length);
    for (const h of ALL_STATUS_HISTORIES) {
      expect(ids.has(h.obligationId)).toBe(true);
      expect(h.history.length).toBeGreaterThan(0);
      for (const fact of h.history) {
        expect(fact.validFrom).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(fact.recordedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(isRegulationStatus(fact.value)).toBe(true);
      }
    }
  });
});

function historyFor(obligationId: string) {
  const entry = ALL_STATUS_HISTORIES.find((h) => h.obligationId === obligationId);
  if (entry === undefined) throw new Error(`no history for ${obligationId}`);
  return entry.history;
}

describe("bitemporal showcases across regimes (ADR-0003)", () => {
  it("EU CSRD wave 2: the Omnibus stop-the-clock reverts a future period", () => {
    const h = historyFor("eu-csrd-esrs-wave2");
    // As known in early 2024, 2026 was scheduled in-effect…
    expect(resolveValueAsOf(h, { validOn: "2026-06-01", knownAsOf: "2024-01-01" })).toBe(
      "in-effect",
    );
    // …but the 2025 stop-the-clock reverted that same period to proposed.
    expect(resolveValueAsOf(h, { validOn: "2026-06-01", knownAsOf: "2025-12-01" })).toBe(
      "proposed",
    );
  });
});
