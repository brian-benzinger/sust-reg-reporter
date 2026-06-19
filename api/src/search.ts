/**
 * Corpus keyword search (ADR-0013).
 *
 * A small, dependency-free ranked substring matcher over the v1 corpus:
 * obligations (their title, regime, id, and pinned citation label) and tracked
 * sources (name, authority, key). Deliberately NOT Postgres full-text: Aurora
 * DSQL is Postgres-*compatible*, not full Postgres, and `tsvector`/GIN support is
 * unverified there (ADR-0012); the corpus is small enough that a pure in-memory
 * scan is instant and — being pure — is fully unit-testable under the coverage
 * gate (ADR-0019). Searching the full snapshot *text* (in S3, not DSQL) is a
 * deliberate non-goal for v1.
 *
 * Scope discipline (ADR-0002): this returns pointers into primary-source corpus
 * metadata — titles, regimes, citations, source names — never advice.
 */
import type { Obligation } from "@sust-reg/core";
import type { SourceSummary } from "./model.ts";

/** A weighted searchable field: a hit in a title should outrank a hit in an id. */
interface Field {
  readonly text: string;
  readonly weight: number;
}

/** One matched obligation, with the score it ranked by. */
export interface ObligationHit {
  readonly obligationId: string;
  readonly regime: string;
  readonly title: string;
  readonly status: string;
  readonly sourceLabel: string;
  readonly sourceUrl?: string;
  readonly firstReportingDeadline?: string;
  readonly score: number;
}

/** One matched tracked source, with the score it ranked by. */
export interface SourceHit {
  readonly key: string;
  readonly name: string;
  readonly authority: string;
  readonly url: string;
  readonly score: number;
}

/** The shaped, ranked search response. */
export interface SearchResults {
  readonly query: string;
  readonly obligations: readonly ObligationHit[];
  readonly sources: readonly SourceHit[];
  readonly total: number;
}

/** The two corpora the matcher ranks over. */
export interface SearchCorpus {
  readonly obligations: readonly Obligation[];
  readonly sources: readonly SourceSummary[];
}

function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Score a record by how its weighted fields match the query. A contiguous
 * *phrase* hit in a field scores double the field weight; each distinct term
 * present adds the field weight again. The sum across fields ranks the record;
 * 0 means no match.
 */
function score(
  fields: readonly Field[],
  phrase: string,
  terms: readonly string[],
): number {
  let total = 0;
  for (const { text, weight } of fields) {
    const hay = text.toLowerCase();
    if (hay.includes(phrase)) total += weight * 2;
    for (const term of terms) {
      if (hay.includes(term)) total += weight;
    }
  }
  return total;
}

/**
 * Rank the corpus against a free-text query. Pure and deterministic: ties break
 * by title/name ascending so the order is stable. A blank query returns nothing
 * (the search box's initial state), never an unfiltered dump.
 */
export function searchCorpus(rawQuery: string, corpus: SearchCorpus): SearchResults {
  const query = rawQuery.trim();
  const phrase = norm(rawQuery);
  if (phrase.length === 0) {
    return { query, obligations: [], sources: [], total: 0 };
  }
  const terms = phrase.split(" ");

  const obligations: ObligationHit[] = corpus.obligations
    .map((o) => ({
      o,
      s: score(
        [
          { text: o.title, weight: 3 },
          { text: o.source.label, weight: 2 },
          { text: o.regime, weight: 2 },
          { text: o.id, weight: 1 },
        ],
        phrase,
        terms,
      ),
    }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.o.title.localeCompare(b.o.title))
    .map(({ o, s }) => ({
      obligationId: o.id,
      regime: o.regime,
      title: o.title,
      status: o.status,
      sourceLabel: o.source.label,
      ...(o.source.sourceUrl !== undefined ? { sourceUrl: o.source.sourceUrl } : {}),
      ...(o.firstReportingDeadline !== undefined
        ? { firstReportingDeadline: o.firstReportingDeadline }
        : {}),
      score: s,
    }));

  const sources: SourceHit[] = corpus.sources
    .map((src) => ({
      src,
      s: score(
        [
          { text: src.name, weight: 3 },
          { text: src.authority, weight: 2 },
          { text: src.key, weight: 1 },
        ],
        phrase,
        terms,
      ),
    }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.src.name.localeCompare(b.src.name))
    .map(({ src, s }) => ({
      key: src.key,
      name: src.name,
      authority: src.authority,
      url: src.url,
      score: s,
    }));

  return { query, obligations, sources, total: obligations.length + sources.length };
}
