import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";
import { createDefaultClassifier } from "semdiff";
import { withDsql } from "../io/db.ts";
import { getSnapshot } from "../io/s3.ts";
import { recordDiff } from "../io/repo.ts";
import { runDiffJob, type DiffDeps, type DiffRequest } from "../diffjob.ts";

const ssm = new SSMClient({});
let cachedApiKey: string | undefined;

/** Read the Anthropic API key from SSM SecureString once, at cold start (ADR-0024). */
async function anthropicApiKey(): Promise<string> {
  if (cachedApiKey !== undefined) return cachedApiKey;
  const name = process.env.ANTHROPIC_KEY_PARAM;
  if (name === undefined) throw new Error("ANTHROPIC_KEY_PARAM is not set");
  const res = await ssm.send(
    new GetParameterCommand({ Name: name, WithDecryption: true }),
  );
  const value = res.Parameter?.Value;
  if (value === undefined || value === "") {
    throw new Error(`SSM parameter ${name} has no value`);
  }
  cachedApiKey = value;
  return value;
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (v === undefined || v === "") throw new Error(`${name} is not set`);
  return v;
}

/**
 * Differ Lambda (ADR-0007) — async-invoked by the ingestor with a `DiffRequest`
 * when a source's content hash changed (so the costly LLM classification never
 * runs on unchanged content). Reads the before/after snapshots from S3 by hash,
 * runs semdiff, and persists the StructuredDiff to `diffs`. Never publicly
 * invokable.
 */
export async function handler(
  req: DiffRequest,
): Promise<{ ok: boolean; substantive: number }> {
  const bucket = requireEnv("SNAPSHOT_BUCKET");
  const apiKey = await anthropicApiKey();
  return withDsql(async (client) => {
    const deps: DiffDeps = {
      getSnapshot: (hash) => getSnapshot(bucket, hash),
      classifier: () => createDefaultClassifier({ apiKey }),
      recordDiff: (record) => recordDiff(client, record),
    };
    const out = await runDiffJob(deps, req);
    return { ok: true, substantive: out.substantive };
  });
}
