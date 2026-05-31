import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";
import { createDefaultClassifier } from "semdiff";
import { diffSnapshots } from "../diff.ts";

/**
 * Differ Lambda (ADR-0007) — runs `semdiff` on a changed snapshot to produce a
 * structured, meaning-aware diff. Invoked by the ingestor ONLY on a changed
 * content hash, so the costly external LLM classification never runs on
 * unchanged content.
 *
 * The Anthropic API key the default classifier needs is read at cold start from
 * an SSM SecureString parameter (ADR-0024) — free, encrypted at rest, granted
 * least-privilege — never an env literal or a value in git. The before/after
 * snapshot text will be read from the content-addressed S3 store (ADR-0011); for
 * now it may ride the event, and the DSQL persist lands next.
 */
interface DifferEvent {
  readonly before?: string;
  readonly after?: string;
}

const ssm = new SSMClient({});
let cachedApiKey: string | undefined;

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

export async function handler(
  event: DifferEvent,
): Promise<{ ok: boolean; substantive: number }> {
  if (event.before !== undefined && event.after !== undefined) {
    const classifier = createDefaultClassifier({
      apiKey: await anthropicApiKey(),
    });
    const result = await diffSnapshots(event.before, event.after, classifier);
    return { ok: true, substantive: result.summary.substantive };
  }
  console.log(JSON.stringify({ msg: "differ invoked (no content)", event }));
  return { ok: true, substantive: 0 };
}
