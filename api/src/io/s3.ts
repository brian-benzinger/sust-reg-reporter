import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";

const s3 = new S3Client({});

/**
 * Fetch a stored snapshot's text by its content-address key (ADR-0011). Used to
 * slice the substantiating quote for a span-level grounding (ADR-0035). Glue —
 * excluded from the coverage gate; the route logic that consumes it is tested
 * against a fake reader.
 */
export async function getSnapshot(bucket: string, key: string): Promise<string> {
  const r = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (r.Body === undefined) throw new Error(`snapshot ${key} has no body`);
  return r.Body.transformToString("utf-8");
}
