import { describe, it, expect } from "vitest";
import { serveRoute } from "../src/corpus.ts";
import type {
  CorpusReader,
  DiffDetail,
  DiffSummary,
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

function reader(over: Partial<CorpusReader> = {}): CorpusReader {
  return {
    listSources: async () => [SOURCE],
    listDiffs: async () => [SUMMARY],
    getDiff: async () => DETAIL,
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

  it("501s the not-yet-implemented features", async () => {
    for (const path of ["/api/as-of", "/api/scope-check"]) {
      const r = await serveRoute(reader(), req(path));
      expect(r.status).toBe(501);
      expect(String(r.body.message)).toContain("not yet implemented");
    }
  });

  it("404s an unknown route", async () => {
    const r = await serveRoute(reader(), req("/api/nope"));
    expect(r.status).toBe(404);
    expect(r.body.route).toBe("not-found");
  });
});
