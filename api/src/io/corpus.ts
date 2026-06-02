import type pg from "pg";
import type {
  ObligationStatusHistory,
  RegulationStatus,
  TemporalFact,
} from "@sust-reg/core";
import { withDsql } from "./db.ts";
import type {
  CorpusReader,
  DiffDetail,
  DiffSummary,
  SourceSummary,
} from "../model.ts";

/**
 * The DSQL-backed `CorpusReader` (ADR-0012). Read-only and parameterized; each
 * method opens one connection (connect-per-invocation). Glue — excluded from the
 * coverage gate; the route logic that consumes it is tested against a fake.
 */
export function dsqlCorpusReader(): CorpusReader {
  return { listSources, listDiffs, getDiff, statusTimelines };
}

/**
 * Reassemble each obligation's append-only status history (ADR-0003). The
 * bitemporal dates are stored as `text` ISO-8601, so they come back as the exact
 * strings the shared resolver compares on — no date coercion. Facts are ordered
 * by record then valid time for a stable timeline.
 */
function statusTimelines(): Promise<ObligationStatusHistory[]> {
  return withDsql(async (c) => {
    const obs = await c.query<{ id: string; regime: string; title: string }>(
      "select id, regime, title from obligations order by id",
    );
    const facts = await c.query<{
      obligation_id: string;
      status: string;
      valid_from: string;
      valid_to: string | null;
      recorded_at: string;
    }>(
      `select obligation_id, status, valid_from, valid_to, recorded_at
       from obligation_status_history
       order by obligation_id, recorded_at, valid_from`,
    );
    const byObligation = new Map<string, TemporalFact<RegulationStatus>[]>();
    for (const f of facts.rows) {
      const list = byObligation.get(f.obligation_id) ?? [];
      list.push({
        value: f.status as RegulationStatus,
        validFrom: f.valid_from,
        ...(f.valid_to !== null ? { validTo: f.valid_to } : {}),
        recordedAt: f.recorded_at,
      });
      byObligation.set(f.obligation_id, list);
    }
    return obs.rows.map((o) => ({
      obligationId: o.id,
      title: o.title,
      regime: o.regime,
      history: byObligation.get(o.id) ?? [],
    }));
  });
}

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const DIFF_COLUMNS = `id, source_key, from_version_id, to_version_id,
  substantive, cosmetic, needs_review, engine_version, created_at`;

function listSources(): Promise<SourceSummary[]> {
  return withDsql(async (c) => {
    const r = await c.query(
      `select s.source_key, s.name, s.authority,
              count(v.id)::int as versions,
              max(v.recorded_at) as latest_recorded_at
       from sources s
       left join source_versions v on v.source_key = s.source_key
       group by s.source_key, s.name, s.authority
       order by s.source_key`,
    );
    return r.rows.map((row) => ({
      key: row.source_key,
      name: row.name,
      authority: row.authority,
      versions: row.versions,
      latestRecordedAt: iso(row.latest_recorded_at),
    }));
  });
}

function listDiffs(sourceKey?: string): Promise<DiffSummary[]> {
  return withDsql(async (c) => {
    const r =
      sourceKey === undefined
        ? await c.query(
            `select ${DIFF_COLUMNS} from diffs order by created_at desc limit 100`,
          )
        : await c.query(
            `select ${DIFF_COLUMNS} from diffs where source_key = $1
             order by created_at desc limit 100`,
            [sourceKey],
          );
    return r.rows.map(toSummary);
  });
}

function getDiff(id: string): Promise<DiffDetail | undefined> {
  if (!UUID.test(id)) return Promise.resolve(undefined);
  return withDsql(async (c) => {
    const r = await c.query(
      `select ${DIFF_COLUMNS}, from_hash, to_hash, schema_version,
              model_id, prompt_version, changes
       from diffs where id = $1`,
      [id],
    );
    const row = r.rows[0];
    if (row === undefined) return undefined;
    return {
      ...toSummary(row),
      fromHash: row.from_hash,
      toHash: row.to_hash,
      schemaVersion: row.schema_version,
      modelId: row.model_id,
      promptVersion: row.prompt_version,
      changes: JSON.parse(row.changes),
    };
  });
}

function toSummary(row: pg.QueryResultRow): DiffSummary {
  return {
    id: row.id,
    sourceKey: row.source_key,
    fromVersionId: row.from_version_id,
    toVersionId: row.to_version_id,
    substantive: row.substantive,
    cosmetic: row.cosmetic,
    needsReview: row.needs_review,
    engineVersion: row.engine_version,
    createdAt: iso(row.created_at) ?? "",
  };
}

function iso(v: Date | string | null): string | null {
  if (v === null || v === undefined) return null;
  return v instanceof Date ? v.toISOString() : String(v);
}
