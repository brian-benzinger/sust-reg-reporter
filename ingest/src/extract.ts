/**
 * Normalize a fetched source body to its meaningful text (ADR-0008).
 *
 * The Federal Register's raw-text endpoint wraps the document in a minimal
 * `<html><body><pre>…</pre>` shell, so we extract the `<pre>` content (and decode
 * the handful of HTML entities it escapes) — snapshots and diffs are then over
 * the document text, not the wrapper. Unknown authorities pass through unchanged
 * (their adapters normalize as needed).
 */
export function extractText(raw: string, authority: string): string {
  if (authority === "federal-register") {
    const match = /<pre>([\s\S]*?)<\/pre>/i.exec(raw);
    const inner = match?.[1];
    if (inner !== undefined) return decodeEntities(inner).trim();
  }
  return raw;
}

function decodeEntities(s: string): string {
  return s
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&amp;", "&");
}
