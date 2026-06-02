// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  fetchScopeCheck,
  fetchAsOf,
  fetchSources,
  fetchDiffs,
} from "../src/api.ts";

afterEach(() => vi.unstubAllGlobals());

/** Stub global.fetch to return a resolved response with the given body. */
function mockFetch(body: unknown, status = 200): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: (): Promise<unknown> => Promise.resolve(body),
    }),
  );
}

/** Return the URL the mocked fetch was called with. */
function fetchedUrl(): string {
  return (
    (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string]
  )[0];
}

describe("fetchScopeCheck", () => {
  it("calls /api/scope-check with all four params", async () => {
    mockFetch({ results: [], applicableCount: 0, enforceableCount: 0 });
    const result = await fetchScopeCheck({
      revenue: "2000000",
      jurisdictions: "US-CA",
      listingStatus: "public-us",
      fiscalYearEnd: "12-31",
    });
    expect(result.applicableCount).toBe(0);
    const url = fetchedUrl();
    expect(url).toContain("/api/scope-check");
    expect(url).toContain("revenue=2000000");
    expect(url).toContain("jurisdictions=US-CA");
    expect(url).toContain("listingStatus=public-us");
    expect(url).toContain("fiscalYearEnd=12-31");
  });

  it("throws on a non-ok response", async () => {
    mockFetch({}, 400);
    await expect(
      fetchScopeCheck({
        revenue: "0",
        jurisdictions: "",
        listingStatus: "private",
        fiscalYearEnd: "12-31",
      }),
    ).rejects.toThrow("HTTP 400");
  });
});

describe("fetchAsOf", () => {
  it("produces no query string when called with no arguments", async () => {
    mockFetch({ validDates: ["2023-01-01"], knowledgeDates: ["2023-01-01"] });
    const result = await fetchAsOf();
    expect(result.validDates).toEqual(["2023-01-01"]);
    expect(fetchedUrl()).toBe("/api/as-of");
  });

  it("includes both date params when both are provided", async () => {
    mockFetch({ validDates: [], knowledgeDates: [], rows: [] });
    await fetchAsOf("2024-01-01", "2025-01-01");
    const url = fetchedUrl();
    expect(url).toContain("validOn=2024-01-01");
    expect(url).toContain("knownAsOf=2025-01-01");
  });

  it("includes only validOn when knownAsOf is omitted", async () => {
    mockFetch({ validDates: [], knowledgeDates: [] });
    await fetchAsOf("2024-01-01");
    const url = fetchedUrl();
    expect(url).toContain("validOn=2024-01-01");
    expect(url).not.toContain("knownAsOf");
  });

  it("throws on a non-ok response", async () => {
    mockFetch({}, 500);
    await expect(fetchAsOf()).rejects.toThrow("HTTP 500");
  });
});

describe("fetchSources", () => {
  it("calls /api/sources with no query string", async () => {
    const src = {
      key: "x",
      name: "Y",
      authority: "z",
      versions: 1,
      latestRecordedAt: null,
    };
    mockFetch({ sources: [src] });
    const result = await fetchSources();
    expect(result.sources).toHaveLength(1);
    expect(fetchedUrl()).toBe("/api/sources");
  });

  it("throws on a non-ok response", async () => {
    mockFetch({}, 503);
    await expect(fetchSources()).rejects.toThrow("HTTP 503");
  });
});

describe("fetchDiffs", () => {
  it("calls /api/diff with no query string by default", async () => {
    mockFetch({ diffs: [] });
    const result = await fetchDiffs();
    expect(result.diffs).toHaveLength(0);
    expect(fetchedUrl()).toBe("/api/diff");
  });

  it("includes the source filter when provided", async () => {
    mockFetch({ diffs: [] });
    await fetchDiffs("my-source");
    expect(fetchedUrl()).toContain("source=my-source");
  });

  it("throws on a non-ok response", async () => {
    mockFetch({}, 404);
    await expect(fetchDiffs()).rejects.toThrow("HTTP 404");
  });
});
