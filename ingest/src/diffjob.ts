import type { Classifier } from "semdiff";
import { diffSnapshots } from "./diff.ts";

/** What the ingestor hands the differ when a source has changed (ADR-0007). */
export interface DiffRequest {
  readonly sourceKey: string;
  readonly fromVersionId: string;
  readonly fromHash: string;
  readonly toVersionId: string;
  readonly toHash: string;
}

/** A diff row ready to persist. */
export interface DiffRecord {
  readonly sourceKey: string;
  readonly fromVersionId: string;
  readonly toVersionId: string;
  readonly fromHash: string;
  readonly toHash: string;
  readonly schemaVersion: string;
  readonly engineVersion: string;
  readonly modelId: string;
  readonly promptVersion: string;
  readonly substantive: number;
  readonly cosmetic: number;
  readonly needsReview: number;
  readonly changes: string;
}

/** Injected I/O for the diff job. */
export interface DiffDeps {
  getSnapshot(contentHash: string): Promise<string>;
  classifier(): Classifier;
  recordDiff(record: DiffRecord): Promise<void>;
}

/**
 * Run a meaning-aware diff for a changed source and persist it (ADR-0007). The
 * before/after snapshot text is read by content hash (the hash IS the S3 key,
 * ADR-0011), so the diff's spans resolve against stored snapshots (citation
 * integrity, ADR-0004). Pure orchestration over injected I/O — unit-tested with
 * a stub classifier and in-memory snapshots.
 */
export async function runDiffJob(
  deps: DiffDeps,
  req: DiffRequest,
): Promise<{ substantive: number }> {
  const before = await deps.getSnapshot(req.fromHash);
  const after = await deps.getSnapshot(req.toHash);
  const diff = await diffSnapshots(before, after, deps.classifier());
  await deps.recordDiff({
    sourceKey: req.sourceKey,
    fromVersionId: req.fromVersionId,
    toVersionId: req.toVersionId,
    fromHash: req.fromHash,
    toHash: req.toHash,
    schemaVersion: diff.schemaVersion,
    engineVersion: diff.provenance.engineVersion,
    modelId: diff.provenance.modelId,
    promptVersion: diff.provenance.promptVersion,
    substantive: diff.summary.substantive,
    cosmetic: diff.summary.cosmetic,
    needsReview: diff.summary.needsReview,
    changes: JSON.stringify(diff.changes),
  });
  return { substantive: diff.summary.substantive };
}
