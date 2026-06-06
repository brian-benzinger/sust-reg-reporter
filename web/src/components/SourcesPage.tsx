import { useState, useEffect } from "react";
import { fetchSources, type SourceSummary } from "../api.ts";
import { formatTimestamp } from "../model.ts";

/** The id of the island element (shared with prerender and client hydration). */
export const SOURCES_ROOT_ID = "sources-root";

/** Authorities behind the tracked sources, with a homepage to learn more. */
const AUTHORITIES: Record<string, { readonly label: string; readonly url: string }> = {
  "federal-register": {
    label: "Federal Register",
    url: "https://www.federalregister.gov",
  },
  "ca-leginfo": {
    label: "California Legislative Information",
    url: "https://leginfo.legislature.ca.gov",
  },
  "eur-lex": { label: "EUR-Lex", url: "https://eur-lex.europa.eu" },
};

/** A link to the primary source artifact (or just text if there is no URL). */
function ExternalLink(props: {
  readonly href: string;
  readonly children: React.ReactNode;
}): React.ReactElement {
  return (
    <a href={props.href} target="_blank" rel="nofollow noopener noreferrer">
      {props.children}
    </a>
  );
}

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
    <div className="table-scroll">
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
          {sources.map((s) => {
            const authority = AUTHORITIES[s.authority];
            return (
              <tr key={s.key}>
                <td>
                  <ExternalLink href={s.url}>{s.name}</ExternalLink>
                </td>
                <td>
                  {authority !== undefined ? (
                    <ExternalLink href={authority.url}>{authority.label}</ExternalLink>
                  ) : (
                    s.authority
                  )}
                </td>
                <td>{s.versions}</td>
                <td>
                  {s.latestRecordedAt !== null
                    ? formatTimestamp(s.latestRecordedAt)
                    : "n/a"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
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
