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

/** Ensure the source row exists (refreshing its display metadata from the
 *  registry), then append an immutable version; return its id. */
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
  } else {
    // The registry is the source of truth for display metadata: refresh
    // name/url/authority when it changes (e.g. a renamed source or a switch to a
    // viewable link). Versions are immutable and untouched.
    await client.query(
      "update sources set name = $2, url = $3, authority = $4 where source_key = $1",
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

/** The two most recent versions of a source (newest first) — for re-diffing an
 *  existing change whose differ run failed (e.g. an earlier OOM). */
export async function latestTwoVersions(
  client: pg.Client,
  sourceKey: string,
): Promise<Array<{ id: string; contentHash: string }>> {
  const r = await client.query<{ id: string; content_hash: string }>(
    `select id, content_hash from source_versions
     where source_key = $1 order by recorded_at desc limit 2`,
    [sourceKey],
  );
  return r.rows.map((row) => ({ id: row.id, contentHash: row.content_hash }));
}

/** Maintenance: remove a source and all of its versions and diffs. DSQL has no
 *  enforced foreign keys, so each table is cleared explicitly. */
export async function deleteSourceData(
  client: pg.Client,
  sourceKey: string,
): Promise<{ diffs: number; versions: number; sources: number }> {
  const d = await client.query("delete from diffs where source_key = $1", [sourceKey]);
  const v = await client.query("delete from source_versions where source_key = $1", [
    sourceKey,
  ]);
  const s = await client.query("delete from sources where source_key = $1", [sourceKey]);
  return {
    diffs: d.rowCount ?? 0,
    versions: v.rowCount ?? 0,
    sources: s.rowCount ?? 0,
  };
}

/** Maintenance: delete a single diff row by id. */
export async function deleteDiffById(client: pg.Client, id: string): Promise<number> {
  const r = await client.query("delete from diffs where id = $1", [id]);
  return r.rowCount ?? 0;
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
