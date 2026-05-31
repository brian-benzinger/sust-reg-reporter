/**
 * The content-hash change gate (ADR-0007, ADR-0010).
 *
 * The ingestor writes a new snapshot and runs the costly, external, LLM-backed
 * differ ONLY when the content hash has changed. This single gate suppresses
 * both redundant storage and redundant LLM spend; an absent last-seen hash (a
 * source's first-ever fetch) counts as changed.
 */
export function hasChanged(
  newHash: string,
  lastSeenHash: string | undefined,
): boolean {
  return newHash !== lastSeenHash;
}
