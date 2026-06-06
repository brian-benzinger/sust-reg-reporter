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
import { SOURCES, getSource, type SourceConfig } from "../sources.ts";
import { fetchText } from "../io/fetch.ts";
import { ping, withDsql } from "../io/db.ts";
import { dsqlSeedDeps } from "../io/obligations.ts";
import {
  deleteDiffById,
  deleteSourceData,
  deleteVersion,
  latestTwoVersions,
  latestVersion,
  recordVersion,
  upsertSourceMeta,
} from "../io/repo.ts";
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
  /** Maintenance: delete a source and all its versions and diffs (e.g. "demo"). */
  readonly deleteSource?: string;
  /** Maintenance: retract one version (and its groundings/diffs) by content hash. */
  readonly deleteVersion?: { readonly sourceKey: string; readonly contentHash: string };
  /** Maintenance: run the real ingest for a registered source over a provided
   *  body instead of fetching it (for sources whose endpoint blocks Lambda). */
  readonly ingestInline?: { readonly sourceKey: string; readonly raw: string };
  /** Maintenance: delete a single diff row by id. */
  readonly deleteDiff?: string;
  /** Maintenance: re-run the differ over a source's latest two versions. */
  readonly rediff?: string;
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
  if (event.deleteSource !== undefined) {
    const key = event.deleteSource;
    return { ok: true, deleted: await withDsql((c) => deleteSourceData(c, key)) };
  }
  if (event.deleteVersion !== undefined) {
    const { sourceKey, contentHash } = event.deleteVersion;
    return {
      ok: true,
      deleted: await withDsql((c) => deleteVersion(c, sourceKey, contentHash)),
    };
  }
  if (event.deleteDiff !== undefined) {
    const id = event.deleteDiff;
    return { ok: true, deletedDiffs: await withDsql((c) => deleteDiffById(c, id)) };
  }
  if (event.ingestInline !== undefined) {
    return runIngestInline(event.ingestInline.sourceKey, event.ingestInline.raw);
  }
  if (event.rediff !== undefined) {
    return runRediff(event.rediff);
  }
  if (event.demo !== undefined) {
    return runDemo(event.demo);
  }
  return runIngest();
}

/**
 * Re-run the differ over a source's latest two versions (ADR-0007). Used to
 * produce a diff for a change whose original differ run failed (e.g. an earlier
 * out-of-memory error); content-addressed and async, so it never re-bills an
 * unchanged source.
 */
async function runRediff(sourceKey: string): Promise<unknown> {
  const versions = await withDsql((c) => latestTwoVersions(c, sourceKey));
  if (versions.length < 2) {
    return { ok: false, reason: "need-two-versions", have: versions.length };
  }
  const [to, from] = versions; // newest first
  const req: DiffRequest = {
    sourceKey,
    fromVersionId: from!.id,
    fromHash: from!.contentHash,
    toVersionId: to!.id,
    toHash: to!.contentHash,
  };
  await invokeDiffer(req);
  return { ok: true, requestedDiff: req };
}

/**
 * Run the real ingest pipeline for a registered source over a provided body
 * instead of fetching it. Same extraction, hashing, content-gate, snapshot,
 * version, and diff request as a scheduled run — only the fetch is replaced.
 * Used to seed/track a source whose authoritative endpoint blocks the Lambda's
 * IP (e.g. EUR-Lex's bot challenge), where a body fetched out-of-band is the
 * same document the endpoint would serve, so the hash stays consistent.
 */
async function runIngestInline(sourceKey: string, raw: string): Promise<unknown> {
  const source = getSource(sourceKey);
  if (source === undefined) {
    return { ok: false, reason: "unknown-source", sourceKey };
  }
  const bucket = requireEnv("SNAPSHOT_BUCKET");
  return withDsql(async (client) => {
    const deps: IngestDeps = {
      fetchText: async () => ({ text: raw, retrievedAt: new Date().toISOString() }),
      latestVersion: (key) => latestVersion(client, key),
      storeSnapshot: async (hash, body) => {
        await putSnapshotIfAbsent(bucket, hash, body);
      },
      recordVersion: (input) => recordVersion(client, input),
      requestDiff: invokeDiffer,
    };
    return { ok: true, result: await ingestSource(deps, source) };
  });
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
      // Keep display metadata in sync with the registry on every pass, even when
      // the content is unchanged (ingestSource only records on a content change).
      await upsertSourceMeta(client, source);
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
