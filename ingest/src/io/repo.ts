import type pg from "pg";
import type { SourceConfig } from "../sources.ts";
import type { DiffRecord } from "../diffjob.ts";

/** The most recent recorded version of a source (id + content hash), if any. */
export async function latestVersion(
  client: pg.Client,
  sourceKey: string,
): Promise<{ id: string; contentHash: string } | undefined> {
  const r = await client.query<{ id: string; content_hash: string }>(
    `select id, content_hash from source_versions
     where source_key = $1 order by recorded_at desc limit 1`,
    [sourceKey],
  );
  const row = r.rows[0];
  return row ? { id: row.id, contentHash: row.content_hash } : undefined;
}

/** Ensure the source row exists, then append an immutable version; return its id. */
export async function recordVersion(
  client: pg.Client,
  input: {
    source: SourceConfig;
    contentHash: string;
    byteSize: number;
    retrievedAt: string;
  },
): Promise<string> {
  const exists = await client.query("select 1 from sources where source_key = $1", [
    input.source.key,
  ]);
  if (exists.rowCount === 0) {
    await client.query(
      "insert into sources (source_key, name, url, authority) values ($1,$2,$3,$4)",
      [input.source.key, input.source.name, input.source.url, input.source.authority],
    );
  }
  // s3_key is the content hash — the snapshot store is content-addressed (ADR-0011).
  const r = await client.query<{ id: string }>(
    `insert into source_versions (source_key, content_hash, s3_key, byte_size, retrieved_at)
     values ($1,$2,$3,$4,$5) returning id`,
    [
      input.source.key,
      input.contentHash,
      input.contentHash,
      input.byteSize,
      input.retrievedAt,
    ],
  );
  return r.rows[0]!.id;
}

/** Append a diff record (ADR-0007). */
export async function recordDiff(client: pg.Client, d: DiffRecord): Promise<void> {
  await client.query(
    `insert into diffs
       (source_key, from_version_id, to_version_id, from_hash, to_hash,
        schema_version, engine_version, model_id, prompt_version,
        substantive, cosmetic, needs_review, changes)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    [
      d.sourceKey,
      d.fromVersionId,
      d.toVersionId,
      d.fromHash,
      d.toHash,
      d.schemaVersion,
      d.engineVersion,
      d.modelId,
      d.promptVersion,
      d.substantive,
      d.cosmetic,
      d.needsReview,
      d.changes,
    ],
  );
}
