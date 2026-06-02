/**
 * Read model for the corpus-backed API (ADR-0013, ADR-0003).
 *
 * These are the JSON shapes the API serves and the `CorpusReader` port it reads
 * them through. Keeping the port abstract lets the route logic (`serveRoute`) be
 * pure and unit-tested with a fake reader; the DSQL/S3 implementation lives in
 * `io/` (glue, excluded from the coverage gate).
 */

/** One tracked source plus how many immutable versions we've recorded. */
export interface SourceSummary {
  readonly key: string;
  readonly name: string;
  readonly authority: string;
  readonly versions: number;
  readonly latestRecordedAt: string | null;
}

/** A meaning-aware diff between two consecutive versions (list view). */
export interface DiffSummary {
  readonly id: string;
  readonly sourceKey: string;
  readonly fromVersionId: string | null;
  readonly toVersionId: string;
  readonly substantive: number;
  readonly cosmetic: number;
  readonly needsReview: number;
  readonly engineVersion: string;
  readonly createdAt: string;
}

/** A single diff with its provenance and the full StructuredDiff changes. */
export interface DiffDetail extends DiffSummary {
  readonly schemaVersion: string;
  readonly modelId: string;
  readonly promptVersion: string;
  readonly fromHash: string | null;
  readonly toHash: string;
  /** Parsed semdiff `StructuredDiff.changes` — each carries citable spans. */
  readonly changes: readonly unknown[];
}

/**
 * Read-only port over the persisted corpus (ADR-0012). Every method connects to
 * DSQL per invocation; the route layer depends only on this interface.
 */
export interface CorpusReader {
  listSources(): Promise<SourceSummary[]>;
  listDiffs(sourceKey?: string): Promise<DiffSummary[]>;
  getDiff(id: string): Promise<DiffDetail | undefined>;
}
