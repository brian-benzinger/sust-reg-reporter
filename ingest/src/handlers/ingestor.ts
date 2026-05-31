import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";
import { contentHash } from "../hash.ts";
import { ingestSource, type IngestDeps, type IngestResult } from "../ingest.ts";
import type { DiffRequest } from "../diffjob.ts";
import { SOURCES, type SourceConfig } from "../sources.ts";
import { fetchText } from "../io/fetch.ts";
import { ping, withDsql } from "../io/db.ts";
import { latestVersion, recordVersion } from "../io/repo.ts";
import { putSnapshotIfAbsent } from "../io/s3.ts";
import { ensureSchema } from "../io/schema.ts";

const lambda = new LambdaClient({});

function requireEnv(name: string): string {
  const v = process.env[name];
  if (v === undefined || v === "") throw new Error(`${name} is not set`);
  return v;
}

/** Async-invoke the differ with a change to classify (ADR-0007). */
async function invokeDiffer(req: DiffRequest): Promise<void> {
  await lambda.send(
    new InvokeCommand({
      FunctionName: requireEnv("DIFFER_FUNCTION_NAME"),
      InvocationType: "Event",
      Payload: Buffer.from(JSON.stringify(req)),
    }),
  );
}

interface IngestorEvent {
  readonly dbPing?: boolean;
  readonly dbInit?: boolean;
  readonly demo?: { readonly before: string; readonly after: string };
}

/**
 * Ingestor Lambda (ADR-0010): the scheduled poll. For each source it fetches,
 * content-hashes, gates, and — on change — writes the snapshot and appends a
 * version, asynchronously invoking the differ when there is a prior version.
 * `dbPing`/`dbInit` are diagnostics; `demo` runs the whole loop over a small
 * inline before/after so the pipeline is verifiable end to end.
 */
export async function handler(event: IngestorEvent = {}): Promise<unknown> {
  if (event.dbPing === true) {
    const r = await ping();
    return { ok: r.ok, db: r.server };
  }
  if (event.dbInit === true) {
    return { ok: true, tables: await withDsql((c) => ensureSchema(c)) };
  }
  if (event.demo !== undefined) {
    return runDemo(event.demo);
  }
  return runIngest();
}

async function runIngest(): Promise<{ ok: boolean; results: IngestResult[] }> {
  const bucket = requireEnv("SNAPSHOT_BUCKET");
  const results = await withDsql(async (client) => {
    const deps: IngestDeps = {
      fetchText,
      latestVersion: (key) => latestVersion(client, key),
      storeSnapshot: async (hash, body) => {
        await putSnapshotIfAbsent(bucket, hash, body);
      },
      recordVersion: (input) => recordVersion(client, input),
      requestDiff: invokeDiffer,
    };
    const out: IngestResult[] = [];
    for (const source of SOURCES) {
      out.push(await ingestSource(deps, source));
    }
    return out;
  });
  return { ok: true, results };
}

const DEMO_SOURCE: SourceConfig = {
  key: "demo",
  name: "Demo source",
  url: "https://example.test/demo",
  authority: "raw",
};

/** Store two inline versions and request a real diff — the whole loop, cheaply. */
async function runDemo(demo: { before: string; after: string }): Promise<unknown> {
  const bucket = requireEnv("SNAPSHOT_BUCKET");
  const now = new Date().toISOString();
  const hashBefore = contentHash(demo.before);
  const hashAfter = contentHash(demo.after);
  await putSnapshotIfAbsent(bucket, hashBefore, demo.before);
  await putSnapshotIfAbsent(bucket, hashAfter, demo.after);
  const req = await withDsql<DiffRequest>(async (client) => {
    const fromVersionId = await recordVersion(client, {
      source: DEMO_SOURCE,
      contentHash: hashBefore,
      byteSize: demo.before.length,
      retrievedAt: now,
    });
    const toVersionId = await recordVersion(client, {
      source: DEMO_SOURCE,
      contentHash: hashAfter,
      byteSize: demo.after.length,
      retrievedAt: now,
    });
    return {
      sourceKey: DEMO_SOURCE.key,
      fromVersionId,
      fromHash: hashBefore,
      toVersionId,
      toHash: hashAfter,
    };
  });
  await invokeDiffer(req);
  return { ok: true, requestedDiff: req };
}
