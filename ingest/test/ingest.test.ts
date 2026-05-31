import { describe, it, expect } from "vitest";
import { ingestSource, type IngestDeps } from "../src/ingest.ts";
import { contentHash } from "../src/hash.ts";
import { extractText } from "../src/extract.ts";
import type { SourceConfig } from "../src/sources.ts";

const source: SourceConfig = {
  key: "demo",
  name: "Demo",
  url: "https://example.test/doc.txt",
  authority: "federal-register",
};

const BODY = "<pre>Covered entities must report annually.</pre>";
const EXPECTED_HASH = contentHash(extractText(BODY, "federal-register"));

function makeDeps(latest: { id: string; contentHash: string } | undefined) {
  const calls = {
    stored: [] as string[],
    versions: 0,
    diffs: [] as { fromVersionId: string; toVersionId: string }[],
  };
  const deps: IngestDeps = {
    fetchText: async () => ({ text: BODY, retrievedAt: "2026-05-31T00:00:00Z" }),
    latestVersion: async () => latest,
    storeSnapshot: async (h) => {
      calls.stored.push(h);
    },
    recordVersion: async () => {
      calls.versions += 1;
      return "new-version-id";
    },
    requestDiff: async (r) => {
      calls.diffs.push(r);
    },
  };
  return { deps, calls };
}

describe("ingestSource (ADR-0010, ADR-0007)", () => {
  it("no-ops when the content hash is unchanged", async () => {
    const { deps, calls } = makeDeps({ id: "v1", contentHash: EXPECTED_HASH });
    const r = await ingestSource(deps, source);
    expect(r.changed).toBe(false);
    expect(calls.stored).toHaveLength(0);
    expect(calls.versions).toBe(0);
    expect(calls.diffs).toHaveLength(0);
  });

  it("stores the first version without requesting a diff", async () => {
    const { deps, calls } = makeDeps(undefined);
    const r = await ingestSource(deps, source);
    expect(r.changed).toBe(true);
    expect(r.diffRequested).toBe(false);
    expect(calls.stored).toEqual([EXPECTED_HASH]);
    expect(calls.versions).toBe(1);
    expect(calls.diffs).toHaveLength(0);
  });

  it("stores a changed version and requests a diff against the prior version", async () => {
    const { deps, calls } = makeDeps({ id: "v1", contentHash: "sha256:older" });
    const r = await ingestSource(deps, source);
    expect(r.changed).toBe(true);
    expect(r.diffRequested).toBe(true);
    expect(calls.versions).toBe(1);
    expect(calls.diffs).toHaveLength(1);
    expect(calls.diffs[0]).toMatchObject({
      fromVersionId: "v1",
      toVersionId: "new-version-id",
    });
  });
});
