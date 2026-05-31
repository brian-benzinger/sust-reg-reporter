import type pg from "pg";

/**
 * Persistence schema for the ingestion corpus (ADR-0003, ADR-0007, ADR-0011).
 *
 * Append-only and content-addressed: `source_versions` records each immutable
 * snapshot of a source (the transaction-time axis — when we recorded it), keyed
 * by content hash; `diffs` stores the meaning-aware StructuredDiff between two
 * consecutive versions. uuid primary keys (DSQL has no sequences); no foreign
 * keys (DSQL does not enforce them — referential integrity is kept in app code);
 * and the StructuredDiff is stored as JSON `text` because DSQL has no `jsonb`
 * type (ADR-0012). The richer regulation/obligation bitemporal corpus follows
 * later.
 */
export const SCHEMA_DDL: readonly string[] = [
  `create table if not exists sources (
    source_key  text primary key,
    name        text not null,
    url         text not null,
    authority   text not null,
    created_at  timestamptz not null default now()
  )`,
  `create table if not exists source_versions (
    id            uuid primary key default gen_random_uuid(),
    source_key    text not null,
    content_hash  text not null,
    s3_key        text not null,
    byte_size     integer not null default 0,
    retrieved_at  timestamptz not null,
    recorded_at   timestamptz not null default now()
  )`,
  `create table if not exists diffs (
    id               uuid primary key default gen_random_uuid(),
    source_key       text not null,
    from_version_id  uuid,
    to_version_id    uuid not null,
    from_hash        text,
    to_hash          text not null,
    schema_version   text not null,
    engine_version   text not null,
    model_id         text not null,
    prompt_version   text not null,
    substantive      integer not null default 0,
    cosmetic         integer not null default 0,
    needs_review     integer not null default 0,
    changes          text not null,
    created_at       timestamptz not null default now()
  )`,
];

/**
 * Idempotently create the schema (`CREATE TABLE IF NOT EXISTS`) and return the
 * tables that now exist. DSQL runs one DDL per (implicit) transaction, so each
 * statement is issued separately.
 */
export async function ensureSchema(client: pg.Client): Promise<string[]> {
  for (const stmt of SCHEMA_DDL) {
    await client.query(stmt);
  }
  const r = await client.query<{ table_name: string }>(
    `select table_name from information_schema.tables
     where table_schema = 'public'
     order by table_name`,
  );
  return r.rows.map((row) => row.table_name);
}
