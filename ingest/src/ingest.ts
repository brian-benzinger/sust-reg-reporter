import { extractText } from "./extract.ts";
import { hasChanged } from "./gate.ts";
import { contentHash } from "./hash.ts";
import type { SourceConfig } from "./sources.ts";
import type { DiffRequest } from "./diffjob.ts";

/** Injected I/O for an ingest run. */
export interface IngestDeps {
  fetchText(url: string): Promise<{ text: string; retrievedAt: string }>;
  latestVersion(
    sourceKey: string,
  ): Promise<{ id: string; contentHash: string } | undefined>;
  storeSnapshot(contentHash: string, body: string): Promise<void>;
  recordVersion(input: {
    source: SourceConfig;
    contentHash: string;
    byteSize: number;
    retrievedAt: string;
  }): Promise<string>;
  requestDiff(request: DiffRequest): Promise<void>;
}

export interface IngestResult {
  readonly sourceKey: string;
  readonly changed: boolean;
  readonly contentHash: string;
  readonly diffRequested: boolean;
}

/**
 * Ingest one source (ADR-0010): fetch → normalize → content-hash → gate. On a
 * changed hash (ADR-0007) store the immutable snapshot (ADR-0011), append the
 * version, and — when there is a prior version to compare against — request a
 * diff. Pure orchestration over injected I/O (unit-tested with fakes).
 */
export async function ingestSource(
  deps: IngestDeps,
  source: SourceConfig,
): Promise<IngestResult> {
  const fetched = await deps.fetchText(source.url);
  const text = extractText(fetched.text, source.authority);
  const hash = contentHash(text);

  const latest = await deps.latestVersion(source.key);
  if (!hasChanged(hash, latest?.contentHash)) {
    return {
      sourceKey: source.key,
      changed: false,
      contentHash: hash,
      diffRequested: false,
    };
  }

  await deps.storeSnapshot(hash, text);
  const toVersionId = await deps.recordVersion({
    source,
    contentHash: hash,
    byteSize: text.length,
    retrievedAt: fetched.retrievedAt,
  });

  if (latest === undefined) {
    return {
      sourceKey: source.key,
      changed: true,
      contentHash: hash,
      diffRequested: false,
    };
  }

  await deps.requestDiff({
    sourceKey: source.key,
    fromVersionId: latest.id,
    fromHash: latest.contentHash,
    toVersionId,
    toHash: hash,
  });
  return {
    sourceKey: source.key,
    changed: true,
    contentHash: hash,
    diffRequested: true,
  };
}
