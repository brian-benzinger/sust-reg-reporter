import { useState, useEffect } from "react";
import { fetchSources, type SourceSummary } from "../api.ts";

/** The id of the island element (shared with prerender and client hydration). */
export const SOURCES_ROOT_ID = "sources-root";

/** Live island: fetches /api/sources on mount and renders the result. */
export function SourcesIsland(): React.ReactElement {
  const [sources, setSources] = useState<readonly SourceSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSources()
      .then((data) => setSources(data.sources))
      .catch((err: unknown) => setError(String(err)));
  }, []);

  if (error !== null) {
    return <p className="error">Could not load sources: {error}</p>;
  }
  if (sources === null) {
    return <p className="loading" aria-live="polite">Loading tracked sources…</p>;
  }
  if (sources.length === 0) {
    return <p>No tracked sources found. Sources are added as the ingestion pipeline runs.</p>;
  }

  return (
    <table className="sources-table">
      <thead>
        <tr>
          <th>Source</th>
          <th>Authority</th>
          <th>Versions</th>
          <th>Latest recorded</th>
        </tr>
      </thead>
      <tbody>
        {sources.map((s) => (
          <tr key={s.key}>
            <td>{s.name}</td>
            <td>{s.authority}</td>
            <td>{s.versions}</td>
            <td>{s.latestRecordedAt ?? "n/a"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** The Sources page: shell content rendered at build time; island hydrated live. */
export function SourcesPage(): React.ReactElement {
  return (
    <>
      <h1>Tracked sources</h1>
      <p className="lead">
        Primary regulatory sources the corpus tracks. Each source is snapshotted
        on a schedule; consecutive versions are diff&apos;d by meaning, not by
        character, using semdiff.
      </p>
      <div id={SOURCES_ROOT_ID}>
        <SourcesIsland />
      </div>
    </>
  );
}
