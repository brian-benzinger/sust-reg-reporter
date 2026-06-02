import type pg from "pg";
import type { ObligationRow, SeedDeps, StatusFactRow } from "../seed.ts";

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
  };
}
