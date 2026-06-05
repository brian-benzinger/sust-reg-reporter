import type pg from "pg";
import type {
  GroundingRow,
  ObligationRow,
  SeedDeps,
  StatusFactRow,
} from "../seed.ts";

/**
 * DSQL-backed `SeedDeps` (ADR-0012). Glue — excluded from the coverage gate;
 * the seed orchestration that consumes it (`seedCorpus`) is tested against
 * fakes.
 *
 * Bitemporal dates are stored as `text` ISO-8601 (`YYYY-MM-DD`), not the SQL
 * `date` type, so they round-trip byte-for-byte through the `pg` driver and
 * keep the exact string semantics the shared resolver compares on (ADR-0003) —
 * no timezone normalization at the boundary.
 */
export function dsqlSeedDeps(client: pg.Client): SeedDeps {
  return {
    obligationExists: async (id: string) => {
      const r = await client.query("select 1 from obligations where id = $1", [id]);
      return (r.rowCount ?? 0) > 0;
    },

    insertObligation: async (row: ObligationRow) => {
      await client.query(
        `insert into obligations
           (id, regime, title, criteria, first_reporting_deadline,
            source_label, source_snapshot_hash, source_url, retrieved_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          row.id,
          row.regime,
          row.title,
          row.criteria,
          row.firstReportingDeadline,
          row.sourceLabel,
          row.sourceSnapshotHash,
          row.sourceUrl,
          row.retrievedAt,
        ],
      );
    },

    statusFactsRecorded: async (obligationId: string) => {
      const r = await client.query<{ n: number }>(
        `select count(*)::int as n
         from obligation_status_history where obligation_id = $1`,
        [obligationId],
      );
      return Number(r.rows[0]?.n ?? 0);
    },

    appendStatusFact: async (row: StatusFactRow) => {
      await client.query(
        `insert into obligation_status_history
           (obligation_id, status, valid_from, valid_to, recorded_at)
         values ($1,$2,$3,$4,$5)`,
        [row.obligationId, row.status, row.validFrom, row.validTo, row.recordedAt],
      );
    },

    latestSourceVersion: async (sourceKey: string) => {
      const r = await client.query<{
        id: string;
        content_hash: string;
        retrieved_at: string;
      }>(
        `select id, content_hash, retrieved_at from source_versions
         where source_key = $1 order by recorded_at desc limit 1`,
        [sourceKey],
      );
      const row = r.rows[0];
      return row
        ? { id: row.id, contentHash: row.content_hash, retrievedAt: row.retrieved_at }
        : undefined;
    },

    groundingExists: async (obligationId: string, contentHash: string) => {
      const r = await client.query(
        `select 1 from obligation_groundings
         where obligation_id = $1 and content_hash = $2`,
        [obligationId, contentHash],
      );
      return (r.rowCount ?? 0) > 0;
    },

    appendGrounding: async (row: GroundingRow) => {
      await client.query(
        `insert into obligation_groundings
           (obligation_id, source_key, source_version_id, content_hash,
            span_start, span_end, retrieved_at, method, confidence, recorded_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          row.obligationId,
          row.sourceKey,
          row.sourceVersionId,
          row.contentHash,
          row.spanStart,
          row.spanEnd,
          row.retrievedAt,
          row.method,
          row.confidence,
          row.recordedAt,
        ],
      );
    },
  };
}
