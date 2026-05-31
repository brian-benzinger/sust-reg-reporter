/**
 * Fetch an authoritative source's raw text (ADR-0008) using the Node runtime's
 * global `fetch`. Returns the body text and the retrieval timestamp (used as the
 * snapshot's `retrieved_at`). A non-2xx response throws so the run fails loudly
 * rather than hashing an error page.
 */
export async function fetchText(
  url: string,
): Promise<{ text: string; retrievedAt: string }> {
  const res = await fetch(url, {
    headers: {
      "user-agent":
        "sust-reg-reporter/0.1 (+https://github.com/brian-benzinger/sust-reg-reporter)",
    },
  });
  if (!res.ok) {
    throw new Error(`fetch ${url} failed: ${res.status} ${res.statusText}`);
  }
  const text = await res.text();
  return { text, retrievedAt: new Date().toISOString() };
}
