import { describe, it, expect } from "vitest";
import type {
  GroundingMethod,
  Obligation,
  ObligationStatusHistory,
} from "@sust-reg/core";
import {
  groundCorpus,
  groundObligation,
  seedCorpus,
  toObligationRow,
  toStatusFactRows,
  type GroundingRow,
  type ObligationRow,
  type SeedDeps,
  type SourceVersionRef,
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
function makeDeps(
  existing: {
    obligations?: string[];
    factsFor?: Record<string, number>;
    /** Latest snapshot per source key. */
    versions?: Record<string, SourceVersionRef>;
    /** Already-grounded `[obligationId, contentHash, method]` triples. */
    groundedKeys?: ReadonlyArray<readonly [string, string, GroundingMethod]>;
    /** Snapshot text per content hash, for span resolution. */
    snapshots?: Record<string, string>;
  } = {},
) {
  const present = new Set(existing.obligations ?? []);
  const factCounts = existing.factsFor ?? {};
  const versions = existing.versions ?? {};
  const snapshots = existing.snapshots ?? {};
  const grounded = new Set(
    (existing.groundedKeys ?? []).map(([o, h, m]) => `${o}::${h}::${m}`),
  );
  const calls = {
    insertedObligations: [] as ObligationRow[],
    appendedFacts: [] as StatusFactRow[],
    appendedGroundings: [] as GroundingRow[],
    snapshotReads: [] as string[],
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
    latestSourceVersion: async (sourceKey) => versions[sourceKey],
    groundingExists: async (obligationId, contentHash, method) =>
      grounded.has(`${obligationId}::${contentHash}::${method}`),
    appendGrounding: async (row) => {
      calls.appendedGroundings.push(row);
      grounded.add(`${row.obligationId}::${row.contentHash}::${row.method}`);
    },
    readSnapshot: async (contentHash) => {
      calls.snapshotReads.push(contentHash);
      const text = snapshots[contentHash];
      if (text === undefined) throw new Error(`no fake snapshot for ${contentHash}`);
      return text;
    },
  };
  return { deps, calls };
}

/** An obligation with a registered source to ground to. */
const GROUNDABLE: Obligation = { ...FULL, sourceKey: "ca-sb261-2023" };

const V1: SourceVersionRef = {
  id: "ver-1",
  contentHash: "sha256:h1",
  retrievedAt: "2026-05-31",
};

/** A located obligation whose text-quote anchor appears in SNAPSHOT_H1. */
const LOCATED: Obligation = {
  ...GROUNDABLE,
  locator: { quote: "Climate-Related Financial Risk Act" },
};

const SNAPSHOT_H1 =
  "Senate Bill 261, the Climate-Related Financial Risk Act, requires a report.";
const QUOTE = "Climate-Related Financial Risk Act";
const QUOTE_START = SNAPSHOT_H1.indexOf(QUOTE);

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

describe("groundObligation / groundCorpus (ADR-0028)", () => {
  it("appends a document-level grounding when the obligation has no locator", async () => {
    const { deps, calls } = makeDeps({ versions: { "ca-sb261-2023": V1 } });
    const r = await groundObligation(deps, GROUNDABLE, "2026-06-03");

    expect(r).toEqual({
      obligationId: GROUNDABLE.id,
      grounded: true,
      reason: "grounded",
      method: "document",
      confidence: "high",
    });
    expect(calls.snapshotReads).toHaveLength(0); // no locator → no S3 fetch
    expect(calls.appendedGroundings).toHaveLength(1);
    expect(calls.appendedGroundings[0]).toEqual({
      obligationId: GROUNDABLE.id,
      sourceKey: "ca-sb261-2023",
      sourceVersionId: "ver-1",
      contentHash: "sha256:h1",
      spanStart: null,
      spanEnd: null,
      retrievedAt: "2026-05-31",
      method: "document",
      confidence: "high",
      recordedAt: "2026-06-03",
    });
  });

  it("skips an obligation with no registered source (stays ungrounded)", async () => {
    const { deps, calls } = makeDeps({ versions: { "ca-sb261-2023": V1 } });
    const r = await groundObligation(deps, MINIMAL, "2026-06-03");
    expect(r).toEqual({ obligationId: MINIMAL.id, grounded: false, reason: "no-source" });
    expect(calls.appendedGroundings).toHaveLength(0);
  });

  it("skips when the source has no ingested snapshot yet", async () => {
    const { deps, calls } = makeDeps({ versions: {} });
    const r = await groundObligation(deps, GROUNDABLE, "2026-06-03");
    expect(r.reason).toBe("no-snapshot");
    expect(calls.appendedGroundings).toHaveLength(0);
  });

  it("is idempotent: does not re-ground an already document-grounded snapshot", async () => {
    const { deps, calls } = makeDeps({
      versions: { "ca-sb261-2023": V1 },
      groundedKeys: [[GROUNDABLE.id, "sha256:h1", "document"]],
    });
    const r = await groundObligation(deps, GROUNDABLE, "2026-06-03");
    expect(r).toEqual({
      obligationId: GROUNDABLE.id,
      grounded: false,
      reason: "already-grounded",
      method: "document",
    });
    expect(calls.appendedGroundings).toHaveLength(0);
  });

  it("re-grounds when the source's latest snapshot has a new hash", async () => {
    const { deps, calls } = makeDeps({
      versions: {
        "ca-sb261-2023": { id: "ver-2", contentHash: "sha256:h2", retrievedAt: "2026-06-02" },
      },
      groundedKeys: [[GROUNDABLE.id, "sha256:h1", "document"]],
    });
    const r = await groundObligation(deps, GROUNDABLE, "2026-06-03");
    expect(r.reason).toBe("grounded");
    expect(calls.appendedGroundings[0]).toMatchObject({
      sourceVersionId: "ver-2",
      contentHash: "sha256:h2",
      retrievedAt: "2026-06-02",
    });
  });

  it("grounds at span level when a locator resolves against the snapshot (ADR-0035)", async () => {
    const { deps, calls } = makeDeps({
      versions: { "ca-sb261-2023": V1 },
      snapshots: { "sha256:h1": SNAPSHOT_H1 },
    });
    const r = await groundObligation(deps, LOCATED, "2026-06-03");

    expect(r).toEqual({
      obligationId: LOCATED.id,
      grounded: true,
      reason: "grounded",
      method: "span",
      confidence: "high",
    });
    expect(calls.appendedGroundings[0]).toMatchObject({
      method: "span",
      confidence: "high",
      spanStart: QUOTE_START,
      spanEnd: QUOTE_START + QUOTE.length,
    });
    // The offsets really delimit the anchored text in the snapshot.
    expect(SNAPSHOT_H1.slice(QUOTE_START, QUOTE_START + QUOTE.length)).toBe(QUOTE);
  });

  it("falls back to document-level when the locator does not resolve", async () => {
    const { deps, calls } = makeDeps({
      versions: { "ca-sb261-2023": V1 },
      snapshots: { "sha256:h1": "a snapshot that does not contain the anchor" },
    });
    const r = await groundObligation(deps, LOCATED, "2026-06-03");

    expect(r).toMatchObject({ grounded: true, reason: "grounded", method: "document" });
    expect(calls.snapshotReads).toEqual(["sha256:h1"]); // it did try to resolve
    expect(calls.appendedGroundings[0]).toMatchObject({
      method: "document",
      spanStart: null,
      spanEnd: null,
    });
  });

  it("upgrades an already document-grounded snapshot to a span grounding (backfill)", async () => {
    const { deps, calls } = makeDeps({
      versions: { "ca-sb261-2023": V1 },
      snapshots: { "sha256:h1": SNAPSHOT_H1 },
      // A document grounding for this exact snapshot already exists...
      groundedKeys: [[LOCATED.id, "sha256:h1", "document"]],
    });
    const r = await groundObligation(deps, LOCATED, "2026-06-03");

    // ...so the locator's first resolution appends a *span* grounding alongside
    // it, which supersedes the document fact on read (ADR-0035).
    expect(r).toMatchObject({ grounded: true, reason: "grounded", method: "span" });
    expect(calls.appendedGroundings).toHaveLength(1);
    expect(calls.appendedGroundings[0]).toMatchObject({ method: "span" });
  });

  it("is idempotent on a span grounding and skips the snapshot fetch", async () => {
    const { deps, calls } = makeDeps({
      versions: { "ca-sb261-2023": V1 },
      snapshots: { "sha256:h1": SNAPSHOT_H1 },
      groundedKeys: [[LOCATED.id, "sha256:h1", "span"]],
    });
    const r = await groundObligation(deps, LOCATED, "2026-06-03");

    expect(r).toEqual({
      obligationId: LOCATED.id,
      grounded: false,
      reason: "already-grounded",
      method: "span",
    });
    expect(calls.appendedGroundings).toHaveLength(0);
    expect(calls.snapshotReads).toHaveLength(0); // already span-grounded → no fetch
  });

  it("carries the resolved confidence (medium) for an ambiguous anchor", async () => {
    const { deps, calls } = makeDeps({
      versions: { "ca-sb261-2023": V1 },
      snapshots: { "sha256:h1": "the report. the report." },
    });
    const located: Obligation = { ...GROUNDABLE, locator: { quote: "the report" } };
    const r = await groundObligation(deps, located, "2026-06-03");

    expect(r).toMatchObject({ method: "span", confidence: "medium" });
    expect(calls.appendedGroundings[0]).toMatchObject({ confidence: "medium", spanStart: 0 });
  });

  it("grounds a corpus, leaving sourceless obligations ungrounded", async () => {
    const { deps, calls } = makeDeps({ versions: { "ca-sb261-2023": V1 } });
    const results = await groundCorpus(deps, [GROUNDABLE, MINIMAL], "2026-06-03");
    expect(results.map((r) => r.reason)).toEqual(["grounded", "no-source"]);
    expect(calls.appendedGroundings).toHaveLength(1);
  });
});
