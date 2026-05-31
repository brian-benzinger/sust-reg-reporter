import { ping, withDsql } from "../io/db.ts";
import { ensureSchema } from "../io/schema.ts";

/**
 * Ingestor Lambda (ADR-0010) — the scheduled poll over authoritative sources
 * (ADR-0008). For each source it will fetch, compute the content address
 * (ADR-0011), and — only when the hash has changed (ADR-0007) — write a new
 * immutable snapshot and asynchronously invoke the differ.
 *
 * Scaffold: the source adapters, S3 write, and differ dispatch land in following
 * changes. `dbPing` proves the Lambda's IAM role can reach DSQL; `dbInit`
 * idempotently creates the schema (ADR-0003).
 */
interface IngestorEvent {
  readonly dbPing?: boolean;
  readonly dbInit?: boolean;
}

export async function handler(
  event: IngestorEvent = {},
): Promise<{
  ok: boolean;
  processed?: number;
  db?: string;
  tables?: string[];
}> {
  if (event.dbPing === true) {
    const r = await ping();
    return { ok: r.ok, db: r.server };
  }
  if (event.dbInit === true) {
    const tables = await withDsql((client) => ensureSchema(client));
    return { ok: true, tables };
  }
  const bucket = process.env.SNAPSHOT_BUCKET;
  const differ = process.env.DIFFER_FUNCTION_NAME;
  console.log(JSON.stringify({ msg: "ingestor invoked", bucket, differ }));
  return { ok: true, processed: 0 };
}
