import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";
import { ALL_OBLIGATIONS, ALL_STATUS_HISTORIES } from "@sust-reg/core";
import { contentHash } from "../hash.ts";
import { ingestSource, type IngestDeps, type IngestResult } from "../ingest.ts";
import type { DiffRequest } from "../diffjob.ts";
import {
  groundCorpus,
  seedCorpus,
  type GroundResult,
  type SeedResult,
} from "../seed.ts";
import { SOURCES, type SourceConfig } from "../sources.ts";
import { fetchText } from "../io/fetch.ts";
import { ping, withDsql } from "../io/db.ts";
import { dsqlSeedDeps } from "../io/obligations.ts";
import { latestVersion, recordVersion } from "../io/repo.ts";
import { putSnapshotIfAbsent } from "../io/s3.ts";
import { ensureSchema, ensureReaderRole } from "../io/schema.ts";

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
  readonly dbGrants?: { readonly role: string; readonly iamRoleArn: string };
  readonly corpusSeed?: boolean;
  readonly demo?: { readonly before: string; readonly after: string };
}

/**
 * Ingestor Lambda (ADR-0010): the scheduled poll. For each source it fetches,
 * content-hashes, gates, and — on change — writes the snapshot and appends a
 * version, asynchronously invoking the differ when there is a prior version.
 * `dbPing`/`dbInit`/`dbGrants` are diagnostics/provisioning; `corpusSeed` loads
 * the v1 obligation corpus and its bitemporal status histories; `demo` runs the
 * whole loop over a small inline before/after so the pipeline is verifiable end
 * to end.
 */
export async function handler(event: IngestorEvent = {}): Promise<unknown> {
  if (event.dbPing === true) {
    const r = await ping();
    return { ok: r.ok, db: r.server };
  }
  if (event.dbInit === true) {
    return { ok: true, tables: await withDsql((c) => ensureSchema(c)) };
  }
  if (event.dbGrants !== undefined) {
    const { role, iamRoleArn } = event.dbGrants;
    return {
      ok: true,
      reader: await withDsql((c) => ensureReaderRole(c, { role, iamRoleArn })),
    };
  }
  if (event.corpusSeed === true) {
    return runCorpusSeed();
  }
  if (event.demo !== undefined) {
    return runDemo(event.demo);
  }
  return runIngest();
}

/** Today as an ISO-8601 `YYYY-MM-DD` string — a grounding's transaction time. */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Load the v1 regulation/obligation corpus and its append-only status histories
 * (ADR-0003, ADR-0009), then ground each obligation to its source's latest
 * snapshot (ADR-0028). Ensures the schema first; everything is idempotent — a
 * re-run neither rewrites obligations, duplicates status facts, nor re-grounds
 * an unchanged snapshot (ADR-0017).
 */
async function runCorpusSeed(): Promise<{
  ok: boolean;
  seeded: SeedResult[];
  grounded: GroundResult[];
}> {
  const recordedAt = today();
  return withDsql(async (client) => {
    await ensureSchema(client);
    const deps = dsqlSeedDeps(client);
    const seeded = await seedCorpus(deps, ALL_OBLIGATIONS, ALL_STATUS_HISTORIES);
    const grounded = await groundCorpus(deps, ALL_OBLIGATIONS, recordedAt);
    return { ok: true, seeded, grounded };
  });
}

async function runIngest(): Promise<{
  ok: boolean;
  results: IngestResult[];
  grounded: GroundResult[];
}> {
  const bucket = requireEnv("SNAPSHOT_BUCKET");
  const recordedAt = today();
  return withDsql(async (client) => {
    const deps: IngestDeps = {
      fetchText,
      latestVersion: (key) => latestVersion(client, key),
      storeSnapshot: async (hash, body) => {
        await putSnapshotIfAbsent(bucket, hash, body);
      },
      recordVersion: (input) => recordVersion(client, input),
      requestDiff: invokeDiffer,
    };
    const results: IngestResult[] = [];
    for (const source of SOURCES) {
      results.push(await ingestSource(deps, source));
    }
    // After any new snapshots are recorded, (re-)ground obligations to their
    // sources' latest versions. Idempotent: an unchanged source is a no-op, and
    // a changed source re-grounds automatically as its new version lands
    // (ADR-0028 §5) — content-hash-gated, so it never re-bills an LLM call.
    const grounded = await groundCorpus(
      dsqlSeedDeps(client),
      ALL_OBLIGATIONS,
      recordedAt,
    );
    return { ok: true, results, grounded };
  });
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
