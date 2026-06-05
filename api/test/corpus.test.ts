import { describe, it, expect } from "vitest";
import { serveRoute } from "../src/corpus.ts";
import type {
  CorpusReader,
  DiffDetail,
  DiffSummary,
  ObligationGroundingHistory,
  ObligationStatusHistory,
  SourceSummary,
} from "../src/model.ts";

const SOURCE: SourceSummary = {
  key: "fedreg-2026-03157",
  name: "EPA GHG endangerment rescission",
  authority: "federal-register",
  versions: 2,
  latestRecordedAt: "2026-05-31T23:54:03.255Z",
};

const SUMMARY: DiffSummary = {
  id: "11111111-1111-1111-1111-111111111111",
  sourceKey: "demo",
  fromVersionId: "v1",
  toVersionId: "v2",
  substantive: 1,
  cosmetic: 0,
  needsReview: 0,
  engineVersion: "0.1.0",
  createdAt: "2026-05-31T23:47:15.757Z",
};

const DETAIL: DiffDetail = {
  ...SUMMARY,
  schemaVersion: "1",
  modelId: "claude",
  promptVersion: "1",
  fromHash: "sha256:a",
  toHash: "sha256:b",
  changes: [{ kind: "substantive" }],
};

// The /as-of route resolves the persisted histories the reader returns. This
// fixture stands in for the seeded corpus: SB 261's enforcement stay (recorded
// 2025) is the bitemporal showcase.
const TIMELINES: ObligationStatusHistory[] = [
  {
    obligationId: "ca-sb253-ghg-disclosure",
    title: "GHG emissions disclosure (Scope 1 & 2)",
    regime: "CA-SB253",
    history: [
      { value: "proposed", validFrom: "2023-01-01", validTo: "2023-10-07", recordedAt: "2023-02-01" },
      { value: "in-effect", validFrom: "2023-10-07", recordedAt: "2023-10-10" },
    ],
  },
  {
    obligationId: "ca-sb261-climate-risk-report",
    title: "Climate-related financial risk report",
    regime: "CA-SB261",
    history: [
      { value: "in-effect", validFrom: "2023-10-07", recordedAt: "2023-10-10" },
      { value: "stayed", validFrom: "2024-12-01", recordedAt: "2025-01-15" },
    ],
  },
];

// SB 261 is grounded to a real snapshot; SB 253 has no grounding fact (it has
// no registered source) and stays ungrounded — the visible distinction the
// reliability layer depends on (ADR-0028, invariant #2). The later fact
// (re-grounded to a newer snapshot) is the one the route should resolve.
const GROUNDINGS: ObligationGroundingHistory[] = [
  {
    obligationId: "ca-sb261-climate-risk-report",
    facts: [
      {
        sourceKey: "ca-sb261-2023",
        sourceVersionId: "ver-1",
        snapshotHash: "sha256:old",
        retrievedAt: "2026-05-01",
        method: "document",
        confidence: "high",
        recordedAt: "2026-05-02",
      },
      {
        sourceKey: "ca-sb261-2023",
        sourceVersionId: "ver-2",
        snapshotHash: "sha256:current",
        retrievedAt: "2026-05-31",
        method: "document",
        confidence: "high",
        recordedAt: "2026-06-03",
      },
    ],
  },
];

function reader(over: Partial<CorpusReader> = {}): CorpusReader {
  return {
    listSources: async () => [SOURCE],
    listDiffs: async () => [SUMMARY],
    getDiff: async () => DETAIL,
    statusTimelines: async () => TIMELINES,
    groundingHistories: async () => GROUNDINGS,
    ...over,
  };
}

const req = (path: string, query: Record<string, string> = {}) => ({
  path,
  query,
});

describe("serveRoute (ADR-0013, ADR-0002)", () => {
  it("carries the not-legal-advice disclaimer on health", async () => {
    const r = await serveRoute(reader(), req("/api/health"));
    expect(r.status).toBe(200);
    expect(r.body.route).toBe("health");
    expect(String(r.body.disclaimer)).toContain("Not legal advice");
    expect(r.body.status).toBe("ok");
  });

  it("lists the tracked sources", async () => {
    const r = await serveRoute(reader(), req("/api/sources"));
    expect(r.status).toBe(200);
    expect(r.body.sources).toEqual([SOURCE]);
  });

  it("lists diffs, passing the source filter through", async () => {
    let got: string | undefined = "unset";
    const r = await serveRoute(
      reader({
        listDiffs: async (sourceKey) => {
          got = sourceKey;
          return [SUMMARY];
        },
      }),
      req("/api/diff", { source: "demo" }),
    );
    expect(r.status).toBe(200);
    expect(r.body.diffs).toEqual([SUMMARY]);
    expect(got).toBe("demo");
  });

  it("returns a single diff with its full changes", async () => {
    const r = await serveRoute(reader(), req(`/api/diff/${SUMMARY.id}`));
    expect(r.status).toBe(200);
    expect(r.body.diff).toEqual(DETAIL);
  });

  it("404s a missing diff", async () => {
    const r = await serveRoute(
      reader({ getDiff: async () => undefined }),
      req("/api/diff/does-not-exist"),
    );
    expect(r.status).toBe(404);
    expect(String(r.body.message)).toContain("does-not-exist");
  });

  it("404s an unknown route", async () => {
    const r = await serveRoute(reader(), req("/api/nope"));
    expect(r.status).toBe(404);
    expect(r.body.route).toBe("not-found");
  });
});

describe("/grounding (ADR-0028)", () => {
  it("returns the current grounding for every grounded obligation", async () => {
    const r = await serveRoute(reader(), req("/api/grounding"));
    expect(r.status).toBe(200);
    expect(r.body.route).toBe("grounding");
    const groundings = r.body.groundings as Array<{
      obligationId: string;
      grounded: boolean;
      confidence: string;
      snapshotHash: string;
      retrievedAt: string;
    }>;
    // Only SB 261 has a grounding fact → one entry, pinned to its latest snapshot.
    expect(groundings).toEqual([
      {
        obligationId: "ca-sb261-climate-risk-report",
        grounded: true,
        confidence: "high",
        snapshotHash: "sha256:current",
        retrievedAt: "2026-05-31",
      },
    ]);
  });

  it("returns an empty list when nothing is grounded", async () => {
    const r = await serveRoute(
      reader({ groundingHistories: async () => [] }),
      req("/api/grounding"),
    );
    expect(r.status).toBe(200);
    expect(r.body.groundings).toEqual([]);
  });
});

describe("/scope-check (ADR-0005)", () => {
  it("marks a large-revenue California company as applicable", async () => {
    const r = await serveRoute(
      reader(),
      req("/api/scope-check", {
        revenue: "2000000000",
        jurisdictions: "US-CA",
        listingStatus: "public-us",
        fiscalYearEnd: "12-31",
      }),
    );
    expect(r.status).toBe(200);
    expect(r.body.route).toBe("scope-check");
    expect(String(r.body.disclaimer)).toContain("Not legal advice");
    expect(Array.isArray(r.body.results)).toBe(true);
    expect(typeof r.body.applicableCount).toBe("number");
    expect(typeof r.body.enforceableCount).toBe("number");
    // A $2B CA company should clear at least one threshold
    expect(r.body.applicableCount as number).toBeGreaterThan(0);
  });

  it("marks a small-revenue company as not applicable", async () => {
    const r = await serveRoute(
      reader(),
      req("/api/scope-check", {
        revenue: "100000",
        jurisdictions: "US-CA",
        listingStatus: "public-us",
        fiscalYearEnd: "12-31",
      }),
    );
    expect(r.status).toBe(200);
    expect(r.body.applicableCount).toBe(0);
    expect(r.body.enforceableCount).toBe(0);
  });

  it("falls back to zero revenue for a non-numeric value", async () => {
    const r = await serveRoute(
      reader(),
      req("/api/scope-check", {
        revenue: "not-a-number",
        jurisdictions: "US-CA",
        listingStatus: "private",
        fiscalYearEnd: "12-31",
      }),
    );
    expect(r.status).toBe(200);
    expect(r.body.applicableCount).toBe(0);
  });

  it("uses default values when no params are provided", async () => {
    const r = await serveRoute(reader(), req("/api/scope-check"));
    expect(r.status).toBe(200);
    // Defaults: revenue=0, jurisdictions=[], listingStatus=private, fiscalYearEnd=12-31
    expect(r.body.applicableCount).toBe(0);
  });

  it("clamps negative revenue to zero", async () => {
    const r = await serveRoute(
      reader(),
      req("/api/scope-check", {
        revenue: "-500",
        jurisdictions: "US-CA",
        listingStatus: "public-us",
        fiscalYearEnd: "12-31",
      }),
    );
    expect(r.status).toBe(200);
    // Negative revenue collapses to zero → below all thresholds
    expect(r.body.applicableCount).toBe(0);
  });

  it("rejects an unknown listingStatus with 400", async () => {
    const r = await serveRoute(
      reader(),
      req("/api/scope-check", {
        revenue: "2000000000",
        jurisdictions: "US-CA",
        listingStatus: "bogus-status",
        fiscalYearEnd: "12-31",
      }),
    );
    expect(r.status).toBe(400);
    expect(String(r.body.message)).toContain("bogus-status");
  });
});

describe("/as-of (ADR-0003)", () => {
  it("returns available slider dates without query params", async () => {
    const r = await serveRoute(reader(), req("/api/as-of"));
    expect(r.status).toBe(200);
    expect(r.body.route).toBe("as-of");
    expect(String(r.body.disclaimer)).toContain("Not legal advice");
    expect(Array.isArray(r.body.validDates)).toBe(true);
    expect(Array.isArray(r.body.knowledgeDates)).toBe(true);
    expect((r.body.validDates as string[]).length).toBeGreaterThan(0);
    expect((r.body.knowledgeDates as string[]).length).toBeGreaterThan(0);
    // Dates are sorted ascending
    const vd = r.body.validDates as string[];
    expect(vd).toEqual([...vd].sort());
  });

  it("returns only dates when knownAsOf is absent", async () => {
    const r = await serveRoute(
      reader(),
      req("/api/as-of", { validOn: "2024-01-01" }), // no knownAsOf
    );
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body.validDates)).toBe(true);
    expect(r.body.rows).toBeUndefined();
    expect(r.body.asOf).toBeUndefined();
  });

  it("resolves rows with undefined status for a date before all histories", async () => {
    const r = await serveRoute(
      reader(),
      req("/api/as-of", { validOn: "2020-01-01", knownAsOf: "2020-01-01" }),
    );
    expect(r.status).toBe(200);
    const rows = r.body.rows as Array<{ obligationId: string; status?: string }>;
    expect(rows.every((row) => row.status === undefined)).toBe(true);
  });

  it("resolves obligation rows for a given (validOn, knownAsOf) pair", async () => {
    const r = await serveRoute(
      reader(),
      req("/api/as-of", { validOn: "2024-01-01", knownAsOf: "2025-06-01" }),
    );
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body.rows)).toBe(true);
    expect(r.body.asOf).toEqual({ validOn: "2024-01-01", knownAsOf: "2025-06-01" });
    // Should include one row per tracked California obligation
    expect((r.body.rows as unknown[]).length).toBeGreaterThan(0);
  });

  it("resolves SB 261 as stayed when known in 2025 but not in mid-2024", async () => {
    const sb261Id = "ca-sb261-climate-risk-report";

    const knownIn2024 = await serveRoute(
      reader(),
      req("/api/as-of", { validOn: "2024-06-01", knownAsOf: "2024-07-01" }),
    );
    const knownIn2025 = await serveRoute(
      reader(),
      req("/api/as-of", { validOn: "2024-12-15", knownAsOf: "2025-06-01" }),
    );

    const rows2024 = knownIn2024.body.rows as Array<{ obligationId: string; status?: string }>;
    const rows2025 = knownIn2025.body.rows as Array<{ obligationId: string; status?: string }>;

    const sb261in2024 = rows2024.find((r) => r.obligationId === sb261Id);
    const sb261in2025 = rows2025.find((r) => r.obligationId === sb261Id);

    expect(sb261in2024?.status).toBe("in-effect");
    expect(sb261in2025?.status).toBe("stayed");
  });

  it("returns empty date axes when the corpus has not been seeded", async () => {
    const r = await serveRoute(
      reader({ statusTimelines: async () => [] }),
      req("/api/as-of"),
    );
    expect(r.status).toBe(200);
    expect(r.body.validDates).toEqual([]);
    expect(r.body.knowledgeDates).toEqual([]);
  });

  it("carries the current grounding provenance on each row (ADR-0028)", async () => {
    const r = await serveRoute(
      reader(),
      req("/api/as-of", { validOn: "2024-01-01", knownAsOf: "2025-06-01" }),
    );
    const rows = r.body.rows as Array<{
      obligationId: string;
      grounded: boolean;
      confidence?: string;
      snapshotHash?: string;
      retrievedAt?: string;
    }>;

    const sb261 = rows.find((x) => x.obligationId === "ca-sb261-climate-risk-report");
    // Grounded to the *latest* recorded snapshot, not the superseded one.
    expect(sb261).toMatchObject({
      grounded: true,
      confidence: "high",
      snapshotHash: "sha256:current",
      retrievedAt: "2026-05-31",
    });

    // SB 253 has no grounding fact → ungrounded, with no snapshot provenance.
    const sb253 = rows.find((x) => x.obligationId === "ca-sb253-ghg-disclosure");
    expect(sb253?.grounded).toBe(false);
    expect(sb253?.snapshotHash).toBeUndefined();
    expect(sb253?.confidence).toBeUndefined();
  });

  it("marks every row ungrounded when no groundings are recorded", async () => {
    const r = await serveRoute(
      reader({ groundingHistories: async () => [] }),
      req("/api/as-of", { validOn: "2024-01-01", knownAsOf: "2025-06-01" }),
    );
    const rows = r.body.rows as Array<{ grounded: boolean }>;
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((x) => x.grounded === false)).toBe(true);
  });
});
