/**
 * Ingestor Lambda (ADR-0010) — the scheduled poll over authoritative sources
 * (ADR-0008). For each source it will fetch, compute the content address
 * (ADR-0011), and — only when the hash has changed (ADR-0007) — write a new
 * immutable snapshot and asynchronously invoke the differ.
 *
 * This is the wiring scaffold; the source adapters, S3 write, and differ
 * dispatch land in a following change. The pure pieces it will use —
 * `contentHash` (../hash) and `hasChanged` (../gate) — are unit tested.
 */
export async function handler(): Promise<{ ok: boolean; processed: number }> {
  const bucket = process.env.SNAPSHOT_BUCKET;
  const differ = process.env.DIFFER_FUNCTION_NAME;
  console.log(JSON.stringify({ msg: "ingestor invoked", bucket, differ }));
  return { ok: true, processed: 0 };
}
