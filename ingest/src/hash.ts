import { createHash } from "node:crypto";

/**
 * Content address of a snapshot (ADR-0011): the SHA-256 of the raw bytes,
 * prefixed `sha256:`. This IS the S3 key and the change-detection signal — two
 * fetches with identical content produce the same address and are stored once.
 */
export function contentHash(content: Uint8Array | string): string {
  const digest = createHash("sha256").update(content).digest("hex");
  return `sha256:${digest}`;
}
