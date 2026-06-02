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

/** The corpus tables the read-only API role is granted SELECT on. */
export const READER_TABLES: readonly string[] = [
  "sources",
  "source_versions",
  "diffs",
];

const IDENT = /^[a-z_][a-z0-9_]*$/i;
const IAM_ROLE_ARN = /^arn:aws:iam::\d{12}:role\/[A-Za-z0-9+=,.@_/-]+$/;

/**
 * Idempotently provision a least-privilege, read-only database role mapped to an
 * IAM role (ADR-0012, ADR-0024). Run as `admin`. The role is `SELECT`-only on the
 * corpus tables so the public-facing API connects with no write capability.
 *
 * DSQL maps IAM identities to database roles with `AWS IAM GRANT` (verified
 * against the DSQL user guide). The role name and ARN are interpolated (these
 * commands take no bind parameters), so both are strictly validated first;
 * `CREATE ROLE` and the mapping are guarded against re-runs, and the `GRANT`s are
 * naturally idempotent.
 */
export async function ensureReaderRole(
  client: pg.Client,
  opts: { role: string; iamRoleArn: string; tables?: readonly string[] },
): Promise<{ role: string; created: boolean; mapped: boolean }> {
  const { role, iamRoleArn } = opts;
  const tables = opts.tables ?? READER_TABLES;
  if (!IDENT.test(role)) throw new Error(`invalid role name: ${role}`);
  if (!IAM_ROLE_ARN.test(iamRoleArn)) {
    throw new Error(`invalid IAM role ARN: ${iamRoleArn}`);
  }
  for (const t of tables) {
    if (!IDENT.test(t)) throw new Error(`invalid table name: ${t}`);
  }

  const exists = await client.query(
    "select 1 from pg_roles where rolname = $1",
    [role],
  );
  const created = exists.rowCount === 0;
  if (created) await client.query(`create role ${role} with login`);

  const alreadyMapped = await client.query(
    "select 1 from sys.iam_pg_role_mappings where arn = $1 and pg_role_name = $2",
    [iamRoleArn, role],
  );
  const mapped = alreadyMapped.rowCount === 0;
  if (mapped) await client.query(`AWS IAM GRANT ${role} TO '${iamRoleArn}'`);

  // No `GRANT USAGE ON SCHEMA public`: DSQL rejects it ("feature not supported
  // on system entity"), and it is unnecessary — the PUBLIC pseudo-role already
  // holds USAGE on the public schema by default, which this role inherits.
  for (const t of tables) {
    await client.query(`grant select on ${t} to ${role}`);
  }
  return { role, created, mapped };
}
