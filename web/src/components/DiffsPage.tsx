import { useState, useEffect } from "react";
import { fetchDiffs, type DiffSummary } from "../api.ts";

/** The id of the island element (shared with prerender and client hydration). */
export const DIFFS_ROOT_ID = "diffs-root";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Live island: fetches /api/diff on mount and renders the change history. */
export function DiffsIsland(): React.ReactElement {
  const [diffs, setDiffs] = useState<readonly DiffSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDiffs()
      .then((data) => setDiffs(data.diffs))
      .catch((err: unknown) => setError(String(err)));
  }, []);

  if (error !== null) {
    return <p className="error">Could not load change history: {error}</p>;
  }
  if (diffs === null) {
    return <p className="loading" aria-live="polite">Loading change history…</p>;
  }
  if (diffs.length === 0) {
    return (
      <p>
        No changes recorded yet. Diffs appear here once the ingestion pipeline
        detects a new version of a tracked source.
      </p>
    );
  }

  return (
    <table className="diffs-table">
      <thead>
        <tr>
          <th>Source</th>
          <th>Substantive</th>
          <th>Cosmetic</th>
          <th>Needs review</th>
          <th>Recorded</th>
        </tr>
      </thead>
      <tbody>
        {diffs.map((d) => (
          <tr key={d.id}>
            <td>{d.sourceKey}</td>
            <td>{d.substantive}</td>
            <td>{d.cosmetic}</td>
            <td>{d.needsReview}</td>
            <td>{formatDate(d.createdAt)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** The Diffs page: shell content rendered at build time; island hydrated live. */
export function DiffsPage(): React.ReactElement {
  return (
    <>
      <h1>Change history</h1>
      <p className="lead">
        Meaning-aware diffs between consecutive versions of tracked regulatory
        sources, produced by semdiff. Substantive changes are ones that alter
        legal obligations; cosmetic changes do not.
      </p>
      <div id={DIFFS_ROOT_ID}>
        <DiffsIsland />
      </div>
    </>
  );
}
