/**
 * Differ Lambda (ADR-0007) — runs `semdiff` to produce a structured,
 * meaning-aware diff. Invoked by the ingestor ONLY on a changed content hash,
 * so the costly external LLM work never runs on unchanged content.
 *
 * This is the wiring scaffold; the semdiff integration and DSQL write land in a
 * following change.
 */
export async function handler(event: unknown): Promise<{ ok: boolean }> {
  console.log(JSON.stringify({ msg: "differ invoked", event }));
  return { ok: true };
}
