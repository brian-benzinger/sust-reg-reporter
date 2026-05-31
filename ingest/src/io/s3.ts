import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const s3 = new S3Client({});

/**
 * Content-addressed, write-once snapshot store (ADR-0011). The key is the
 * content hash, so identical content maps to a single object. The store is
 * immutable and object-locked, so this is put-IF-ABSENT (`If-None-Match: *`): a
 * re-store of already-present content is a no-op, never an overwrite — which
 * also makes a retried ingest idempotent (ADR-0017).
 *
 * Returns true if a new object was written, false if that content already
 * existed.
 */
export async function putSnapshotIfAbsent(
  bucket: string,
  key: string,
  body: string,
): Promise<boolean> {
  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: "text/plain; charset=utf-8",
        IfNoneMatch: "*",
      }),
    );
    return true;
  } catch (err) {
    if (isPreconditionFailed(err)) return false;
    throw err;
  }
}

function isPreconditionFailed(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
  return e.name === "PreconditionFailed" || e.$metadata?.httpStatusCode === 412;
}

/** Fetch a stored snapshot's text by its content-address key. */
export async function getSnapshot(bucket: string, key: string): Promise<string> {
  const r = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (r.Body === undefined) throw new Error(`snapshot ${key} has no body`);
  return r.Body.transformToString("utf-8");
}
