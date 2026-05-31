import { diffSnapshots } from "../diff.ts";

/**
 * Differ Lambda (ADR-0007) — runs `semdiff` to produce a structured,
 * meaning-aware diff. Invoked by the ingestor ONLY on a changed content hash,
 * so the costly external LLM classification never runs on unchanged content.
 *
 * The before/after snapshot text will be read from the content-addressed S3
 * store (ADR-0011); for now it may ride the event. The S3 fetch and the DSQL
 * persist of the resulting StructuredDiff land in a following change, as does
 * the ANTHROPIC_API_KEY wiring the default classifier needs in production.
 */
interface DifferEvent {
  readonly before?: string;
  readonly after?: string;
}

export async function handler(
  event: DifferEvent,
): Promise<{ ok: boolean; substantive: number }> {
  if (event.before !== undefined && event.after !== undefined) {
    const result = await diffSnapshots(event.before, event.after);
    return { ok: true, substantive: result.summary.substantive };
  }
  console.log(JSON.stringify({ msg: "differ invoked (no content)", event }));
  return { ok: true, substantive: 0 };
}
