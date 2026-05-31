import { ping } from "../io/db.ts";

/**
 * Ingestor Lambda (ADR-0010) — the scheduled poll over authoritative sources
 * (ADR-0008). For each source it will fetch, compute the content address
 * (ADR-0011), and — only when the hash has changed (ADR-0007) — write a new
 * immutable snapshot and asynchronously invoke the differ.
 *
 * Scaffold: the source adapters, S3 write, and differ dispatch land in following
 * changes. A `dbPing` path proves the Lambda's own IAM role can reach DSQL.
 */
interface IngestorEvent {
  readonly dbPing?: boolean;
}

export async function handler(
  event: IngestorEvent = {},
): Promise<{ ok: boolean; processed?: number; db?: string }> {
  if (event.dbPing === true) {
    const r = await ping();
    return { ok: r.ok, db: r.server };
  }
  const bucket = process.env.SNAPSHOT_BUCKET;
  const differ = process.env.DIFFER_FUNCTION_NAME;
  console.log(JSON.stringify({ msg: "ingestor invoked", bucket, differ }));
  return { ok: true, processed: 0 };
}
