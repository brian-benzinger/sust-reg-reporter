/** An authoritative source we poll for change detection (ADR-0008). */
export interface SourceConfig {
  /** Stable identifier — the key in `sources` / `source_versions`. */
  readonly key: string;
  readonly name: string;
  /** The fetchable URL of the source's raw text. */
  readonly url: string;
  /** Provenance: which authoritative source / official API. */
  readonly authority: string;
}

/**
 * v1 source registry (ADR-0008, ADR-0009). A real, fetchable Federal Register
 * document exercises the pipeline end to end; the California SB 261 bill text is
 * the first authoritative source for an actual v1 regime — the obligation whose
 * status history (the enforcement stay) drives the as-of slider. EUR-Lex
 * (CSRD/Omnibus) and ISSB adapters follow.
 */
export const SOURCES: readonly SourceConfig[] = [
  {
    key: "fedreg-2026-03157",
    name: "EPA — Rescission of the GHG Endangerment Finding (FR 2026-03157)",
    url: "https://www.federalregister.gov/documents/full_text/text/2026/02/18/2026-03157.txt",
    authority: "federal-register",
  },
  {
    key: "ca-sb261-2023",
    name: "California SB 261 (2023) — Climate-Related Financial Risk Act",
    url: "https://leginfo.legislature.ca.gov/faces/billTextClient.xhtml?bill_id=202320240SB261",
    authority: "ca-leginfo",
  },
];

/** Look up a source by its key. */
export function getSource(key: string): SourceConfig | undefined {
  return SOURCES.find((s) => s.key === key);
}
