import { useState } from "react";
import { fetchSearch, type SearchApiResult } from "../api.ts";

/** The id of the island element (shared with prerender and client hydration). */
export const SEARCH_ROOT_ID = "search-root";

/** Seeded example queries so the empty page teaches what is searchable. */
const EXAMPLES = ["scope 3", "climate risk", "CSRD", "California"];

/** Render the obligation + source hits, or an honest empty state. */
function Results(props: {
  readonly results: SearchApiResult;
  readonly query: string;
}): React.ReactElement {
  const { results, query } = props;
  if (results.total === 0) {
    return (
      <p className="search-empty">
        No matches for <q>{query}</q>. Search covers obligation titles, regimes,
        and citations, and tracked source names — not the full regulation text
        yet.
      </p>
    );
  }
  return (
    <div className="search-results">
      {results.obligations.length > 0 ? (
        <section aria-label="Matching obligations">
          <h2>Obligations ({results.obligations.length})</h2>
          <ul className="search-list">
            {results.obligations.map((o) => (
              <li key={o.obligationId}>
                <a href={`/regimes/${o.obligationId}.html`}>{o.title}</a>
                <span className="meta">
                  {o.regime} · {o.status}
                </span>
                <span className="cite">{o.sourceLabel}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {results.sources.length > 0 ? (
        <section aria-label="Matching sources">
          <h2>Sources ({results.sources.length})</h2>
          <ul className="search-list">
            {results.sources.map((s) => (
              <li key={s.key}>
                <a
                  href={s.url}
                  target="_blank"
                  rel="nofollow noopener noreferrer"
                >
                  {s.name}
                </a>
                <span className="meta">{s.authority}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

/**
 * Live island: a keyword search over the corpus (ADR-0013). Submits the query to
 * /api/search and renders ranked obligation + source hits. It does not fetch on
 * mount — the prerendered shell is the empty form, which the client hydrates
 * unchanged — and a blank query simply clears the results.
 */
export function SearchIsland(): React.ReactElement {
  const [query, setQuery] = useState("");
  const [searched, setSearched] = useState("");
  const [results, setResults] = useState<SearchApiResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = (raw: string): void => {
    setQuery(raw);
    const trimmed = raw.trim();
    setSearched(trimmed);
    setError(null);
    if (trimmed.length === 0) {
      setResults(null);
      return;
    }
    setLoading(true);
    fetchSearch(trimmed)
      .then((data) => setResults(data))
      .catch((err: unknown) => setError(String(err)))
      .finally(() => setLoading(false));
  };

  return (
    <>
      <form
        className="search panel"
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          run(query);
        }}
      >
        <input
          type="search"
          value={query}
          placeholder="Search obligations and sources…"
          aria-label="Search the corpus"
          onChange={(event) => setQuery(event.target.value)}
        />
        <button type="submit">Search</button>
      </form>

      <p className="search-examples">
        Try:{" "}
        {EXAMPLES.map((example, i) => (
          <span key={example}>
            {i > 0 ? " · " : ""}
            <button type="button" className="chip" onClick={() => run(example)}>
              {example}
            </button>
          </span>
        ))}
      </p>

      <div className="search-status" role="status" aria-live="polite">
        {loading ? <span className="loading">Searching…</span> : null}
      </div>

      {error !== null ? (
        <p className="error">Could not run search: {error}</p>
      ) : null}

      {results !== null && !loading ? (
        <Results results={results} query={searched} />
      ) : null}
    </>
  );
}

/** The Search page: prerendered shell + scope framing; island hydrated live. */
export function SearchPage(): React.ReactElement {
  return (
    <>
      <h1>Search the corpus</h1>
      <p className="lead">
        Search the disclosure obligations and tracked sources in the v1 corpus by
        keyword. Matches cover obligation titles, regimes, and citations, and
        source names — not the full regulation text (yet).
      </p>
      <div id={SEARCH_ROOT_ID}>
        <SearchIsland />
      </div>
    </>
  );
}
