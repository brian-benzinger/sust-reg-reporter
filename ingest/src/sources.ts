/** An authoritative source we poll for change detection (ADR-0008). */
export interface SourceConfig {
  /** Stable identifier — the key in `sources` / `source_versions`. */
  readonly key: string;
  readonly name: string;
  /** The human-viewable canonical URL, surfaced as the source's link. */
  readonly url: string;
  /**
   * The URL fetched for content, when it differs from the viewable `url` (e.g. a
   * raw-text endpoint behind a viewable document page). Defaults to `url`.
   */
  readonly fetchUrl?: string;
  /** Provenance: which authoritative source / official API. */
  readonly authority: string;
}

/**
 * v1 source registry (ADR-0008, ADR-0009), one authoritative source per regime:
 * a Federal Register document exercises the pipeline; California SB 253 and
 * SB 261 (leginfo) and EU CSRD (EUR-Lex) are the public-domain primary sources
 * for the CA and EU regimes.
 *
 * ISSB (IFRS S1/S2) has NO source here and is deferred from v1 (ADR-0027): the
 * IFRS Foundation publishes the standards text under copyright, and its terms
 * forbid integrating it into a data service or product without a separate
 * licence — exactly what storing and serving snapshots would do — so it cannot
 * be ingested until such a licence is in place.
 */
export const SOURCES: readonly SourceConfig[] = [
  {
    key: "fedreg-2026-03157",
    name: "EPA: Rescission of the GHG Endangerment Finding (FR 2026-03157)",
    // Human-viewable HTML document page (what the site links to); the raw-text
    // endpoint in `fetchUrl` is what we fetch and diff (cleaner, tag-stripped).
    url: "https://www.federalregister.gov/documents/full_text/html/2026/02/18/2026-03157.html",
    fetchUrl: "https://www.federalregister.gov/documents/full_text/text/2026/02/18/2026-03157.txt",
    authority: "federal-register",
  },
  {
    key: "ca-sb253-2023",
    name: "California SB 253 (2023): Climate Corporate Data Accountability Act",
    url: "https://leginfo.legislature.ca.gov/faces/billTextClient.xhtml?bill_id=202320240SB253",
    authority: "ca-leginfo",
  },
  {
    key: "ca-sb261-2023",
    name: "California SB 261 (2023): Climate-Related Financial Risk Act",
    url: "https://leginfo.legislature.ca.gov/faces/billTextClient.xhtml?bill_id=202320240SB261",
    authority: "ca-leginfo",
  },
  {
    key: "eu-csrd-2022-2464",
    // Track the in-force CONSOLIDATED text, not the immutable act-as-adopted: a
    // tracker should follow amendments (Omnibus "stop the clock" 2025/794, scope
    // simplification 2026/470), which only land in the consolidated version. The
    // CELEX `0…-YYYYMMDD` form pins a specific consolidation date (stable content).
    name: "EU CSRD: Directive (EU) 2022/2464 (consolidated, post-Omnibus)",
    url: "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:02022L2464-20260318",
    authority: "eur-lex",
  },
];

/** Look up a source by its key. */
export function getSource(key: string): SourceConfig | undefined {
  return SOURCES.find((s) => s.key === key);
}
