import { describe, it, expect } from "vitest";
import type { Obligation, ObligationStatusHistory } from "@sust-reg/core";
import {
  seedCorpus,
  toObligationRow,
  toStatusFactRows,
  type ObligationRow,
  type SeedDeps,
  type StatusFactRow,
} from "../src/seed.ts";

const FULL: Obligation = {
  id: "ca-sb261-climate-risk-report",
  regime: "CA-SB261",
  title: "Climate-related financial risk report",
  status: "in-effect",
  criteria: { minTotalAnnualRevenueUSD: 500_000_000, operatesInAnyOf: ["US-CA"] },
  firstReportingDeadline: "2026-01-01",
  source: {
    label: "California SB 261 (2023)",
    snapshotHash: "sha256:grounded",
    sourceUrl: "https://leginfo.example/sb261",
    retrievedAt: "2026-05-31",
  },
};

const MINIMAL: Obligation = {
  id: "ca-sb253-ghg-disclosure",
  regime: "CA-SB253",
  title: "GHG emissions disclosure",
  status: "in-effect",
  criteria: { operatesInAnyOf: ["US-CA"] },
  source: { label: "California SB 253 (2023)", snapshotHash: "ungrounded:seed" },
};

const HISTORY: ObligationStatusHistory = {
  obligationId: FULL.id,
  title: FULL.title,
  regime: FULL.regime,
  history: [
    { value: "in-effect", validFrom: "2023-10-07", validTo: "2024-12-01", recordedAt: "2023-10-10" },
    { value: "stayed", validFrom: "2024-12-01", recordedAt: "2025-01-15" },
  ],
};

/** A fake `SeedDeps` recording every write, with a preset existing state. */
function makeDeps(existing: { obligations?: string[]; factsFor?: Record<string, number> } = {}) {
  const present = new Set(existing.obligations ?? []);
  const factCounts = existing.factsFor ?? {};
  const calls = {
    insertedObligations: [] as ObligationRow[],
    appendedFacts: [] as StatusFactRow[],
  };
  const deps: SeedDeps = {
    obligationExists: async (id) => present.has(id),
    insertObligation: async (row) => {
      calls.insertedObligations.push(row);
    },
    statusFactsRecorded: async (id) => factCounts[id] ?? 0,
    appendStatusFact: async (row) => {
      calls.appendedFacts.push(row);
    },
  };
  return { deps, calls };
}

describe("toObligationRow / toStatusFactRows (ADR-0003)", () => {
  it("projects an obligation, JSON-encoding criteria and grounding the citation", () => {
    const row = toObligationRow(FULL);
    expect(row).toMatchObject({
      id: FULL.id,
      regime: "CA-SB261",
      firstReportingDeadline: "2026-01-01",
      sourceSnapshotHash: "sha256:grounded",
      sourceUrl: "https://leginfo.example/sb261",
      retrievedAt: "2026-05-31",
    });
    expect(JSON.parse(row.criteria)).toEqual(FULL.criteria);
  });

  it("nulls absent optional fields", () => {
    const row = toObligationRow(MINIMAL);
    expect(row.firstReportingDeadline).toBeNull();
    expect(row.sourceUrl).toBeNull();
    expect(row.retrievedAt).toBeNull();
  });

  it("flattens history facts, nulling an open-ended validTo", () => {
    const rows = toStatusFactRows(HISTORY);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ status: "in-effect", validTo: "2024-12-01" });
    expect(rows[1]).toMatchObject({ status: "stayed", validTo: null });
  });
});

describe("seedCorpus (ADR-0003, ADR-0017)", () => {
  it("inserts obligations and appends matched histories on a fresh corpus", async () => {
    const { deps, calls } = makeDeps();
    const results = await seedCorpus(deps, [FULL, MINIMAL], [HISTORY]);

    expect(calls.insertedObligations.map((o) => o.id)).toEqual([FULL.id, MINIMAL.id]);
    expect(calls.appendedFacts).toHaveLength(2);
    expect(results).toEqual([
      { obligationId: FULL.id, obligationInserted: true, statusFactsAppended: 2 },
      // MINIMAL has no matching history → nothing appended.
      { obligationId: MINIMAL.id, obligationInserted: true, statusFactsAppended: 0 },
    ]);
  });

  it("is idempotent: an existing obligation with recorded facts is left untouched", async () => {
    const { deps, calls } = makeDeps({
      obligations: [FULL.id],
      factsFor: { [FULL.id]: 2 },
    });
    const results = await seedCorpus(deps, [FULL], [HISTORY]);

    expect(calls.insertedObligations).toHaveLength(0);
    expect(calls.appendedFacts).toHaveLength(0);
    expect(results[0]).toEqual({
      obligationId: FULL.id,
      obligationInserted: false,
      statusFactsAppended: 0,
    });
  });

  it("backfills history for an already-present obligation that has none recorded", async () => {
    const { deps, calls } = makeDeps({ obligations: [FULL.id] });
    const results = await seedCorpus(deps, [FULL], [HISTORY]);

    expect(calls.insertedObligations).toHaveLength(0);
    expect(calls.appendedFacts).toHaveLength(2);
    expect(results[0]).toEqual({
      obligationId: FULL.id,
      obligationInserted: false,
      statusFactsAppended: 2,
    });
  });
});
