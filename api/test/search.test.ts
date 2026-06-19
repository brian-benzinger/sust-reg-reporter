import { describe, it, expect } from "vitest";
import { searchCorpus } from "../src/search.ts";
import type { Obligation } from "@sust-reg/core";
import type { SourceSummary } from "../src/model.ts";

const obligation = (over: Partial<Obligation> = {}): Obligation => ({
  id: "ca-sb253-ghg",
  regime: "CA-SB253",
  title: "GHG emissions disclosure",
  status: "in-effect",
  criteria: {},
  source: {
    label: "California SB 253 (2023), § 38532",
    snapshotHash: "ungrounded:seed",
  },
  ...over,
});

const source = (over: Partial<SourceSummary> = {}): SourceSummary => ({
  key: "ca-sb253-2023",
  name: "California SB 253 (2023)",
  url: "https://example.org/sb253",
  authority: "ca-leginfo",
  versions: 1,
  latestRecordedAt: null,
  ...over,
});

describe("searchCorpus (ADR-0013)", () => {
  it("returns nothing for a blank or whitespace query (the box's initial state)", () => {
    for (const q of ["", "   ", "\t\n"]) {
      const r = searchCorpus(q, {
        obligations: [obligation()],
        sources: [source()],
      });
      expect(r).toEqual({
        query: q.trim(),
        obligations: [],
        sources: [],
        total: 0,
      });
    }
  });

  it("matches obligation titles case-insensitively", () => {
    const r = searchCorpus("EMISSIONS", {
      obligations: [obligation()],
      sources: [],
    });
    expect(r.total).toBe(1);
    expect(r.obligations[0]?.obligationId).toBe("ca-sb253-ghg");
    expect(r.obligations[0]?.score).toBeGreaterThan(0);
  });

  it("matches the pinned citation label", () => {
    const r = searchCorpus("38532", { obligations: [obligation()], sources: [] });
    expect(r.obligations).toHaveLength(1);
  });

  it("matches tracked sources by authority", () => {
    const r = searchCorpus("leginfo", { obligations: [], sources: [source()] });
    expect(r.sources).toHaveLength(1);
    expect(r.sources[0]?.key).toBe("ca-sb253-2023");
    expect(r.sources[0]?.url).toBe("https://example.org/sb253");
  });

  it("ranks a title hit above an id-only hit (field weighting)", () => {
    const titleHit = obligation({ id: "a", title: "climate risk report" });
    const idHit = obligation({
      id: "climate",
      title: "Something else",
      regime: "ZZ",
      source: { label: "x", snapshotHash: "ungrounded:seed" },
    });
    const r = searchCorpus("climate", {
      obligations: [idHit, titleHit],
      sources: [],
    });
    expect(r.obligations[0]?.obligationId).toBe("a");
  });

  it("ranks a contiguous phrase above a partial-term match", () => {
    const phrase = obligation({ id: "p", title: "climate risk report" });
    const partial = obligation({
      id: "q",
      title: "climate data summary",
      regime: "R",
      source: { label: "l", snapshotHash: "ungrounded:seed" },
    });
    const r = searchCorpus("climate risk", {
      obligations: [phrase, partial],
      sources: [],
    });
    expect(r.obligations[0]?.obligationId).toBe("p");
    expect(r.total).toBe(2); // both still match on "climate"
  });

  it("breaks score ties by title ascending for a stable order", () => {
    const beta = obligation({
      id: "b",
      title: "Beta climate",
      regime: "R",
      source: { label: "l", snapshotHash: "ungrounded:seed" },
    });
    const alpha = obligation({
      id: "a",
      title: "Alpha climate",
      regime: "R",
      source: { label: "l", snapshotHash: "ungrounded:seed" },
    });
    const r = searchCorpus("climate", {
      obligations: [beta, alpha],
      sources: [],
    });
    expect(r.obligations.map((o) => o.title)).toEqual([
      "Alpha climate",
      "Beta climate",
    ]);
  });

  it("breaks source ties by name ascending", () => {
    const z = source({ key: "z", name: "Zeta registry", authority: "x" });
    const a = source({ key: "a", name: "Alpha registry", authority: "x" });
    const r = searchCorpus("registry", { obligations: [], sources: [z, a] });
    expect(r.sources.map((s) => s.name)).toEqual([
      "Alpha registry",
      "Zeta registry",
    ]);
  });

  it("carries optional sourceUrl and deadline only when present", () => {
    const withOpt = obligation({
      id: "w",
      title: "emissions with extras",
      source: {
        label: "lbl",
        snapshotHash: "h",
        sourceUrl: "https://x.example",
      },
      firstReportingDeadline: "2026-01-01",
    });
    const withoutOpt = obligation({ id: "n", title: "emissions plain" });
    const r = searchCorpus("emissions", {
      obligations: [withOpt, withoutOpt],
      sources: [],
    });
    const w = r.obligations.find((o) => o.obligationId === "w");
    const n = r.obligations.find((o) => o.obligationId === "n");
    expect(w?.sourceUrl).toBe("https://x.example");
    expect(w?.firstReportingDeadline).toBe("2026-01-01");
    expect(n?.sourceUrl).toBeUndefined();
    expect(n?.firstReportingDeadline).toBeUndefined();
  });

  it("returns no hits when nothing matches", () => {
    const r = searchCorpus("zzzznothing", {
      obligations: [obligation()],
      sources: [source()],
    });
    expect(r.total).toBe(0);
    expect(r.obligations).toEqual([]);
    expect(r.sources).toEqual([]);
  });
});
