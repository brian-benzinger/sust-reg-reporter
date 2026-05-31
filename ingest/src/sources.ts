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
 * v1 source registry (ADR-0008, ADR-0009). Seeded with one real, fetchable
 * Federal Register document to exercise the pipeline end to end; per-regime
 * adapters (CARB docket, EUR-Lex, ISSB) follow.
 */
export const SOURCES: readonly SourceConfig[] = [
  {
    key: "fedreg-2026-03157",
    name: "EPA — Rescission of the GHG Endangerment Finding (FR 2026-03157)",
    url: "https://www.federalregister.gov/documents/full_text/text/2026/02/18/2026-03157.txt",
    authority: "federal-register",
  },
];

/** Look up a source by its key. */
export function getSource(key: string): SourceConfig | undefined {
  return SOURCES.find((s) => s.key === key);
}
