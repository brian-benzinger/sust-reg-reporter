import { Fragment, useState, useEffect } from "react";
import {
  fetchDiffs,
  fetchDiff,
  type DiffChange,
  type DiffSummary,
} from "../api.ts";

/** The id of the island element (shared with prerender and client hydration). */
export const DIFFS_ROOT_ID = "diffs-root";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** The classified changes within one diff, each with its before/after text. */
function ChangeList(props: {
  readonly changes: readonly DiffChange[];
}): React.ReactElement {
  if (props.changes.length === 0) {
    return <p className="muted">No individual changes recorded.</p>;
  }
  return (
    <ol className="change-list">
      {props.changes.map((c, i) => (
        <li key={i} className="change">
          <p className="change-head">
            <span className={`badge ${c.classification}`}>{c.classification}</span>
            <span className="change-type">{c.type}</span>
            {c.needsReview ? <span className="badge ungrounded">needs review</span> : null}
          </p>
          {c.description !== undefined ? (
            <p className="change-desc">{c.description}</p>
          ) : null}
          {c.textA !== "" ? (
            <p className="change-text del">
              <span className="change-label">before</span> {c.textA}
            </p>
          ) : null}
          {c.textB !== "" ? (
            <p className="change-text ins">
              <span className="change-label">after</span> {c.textB}
            </p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

type DetailState = readonly DiffChange[] | "loading" | "error";

/** Live island: fetches /api/diff on mount and renders the change history. */
export function DiffsIsland(): React.ReactElement {
  const [diffs, setDiffs] = useState<readonly DiffSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, DetailState>>({});

  useEffect(() => {
    fetchDiffs()
      .then((data) => setDiffs(data.diffs))
      .catch((err: unknown) => setError(String(err)));
  }, []);

  // Toggle a row open; lazily fetch its per-change detail the first time.
  const toggle = (id: string): void => {
    if (openId === id) {
      setOpenId(null);
      return;
    }
    setOpenId(id);
    if (details[id] === undefined) {
      setDetails((d) => ({ ...d, [id]: "loading" }));
      fetchDiff(id)
        .then((detail) => setDetails((d) => ({ ...d, [id]: detail.changes })))
        .catch(() => setDetails((d) => ({ ...d, [id]: "error" })));
    }
  };

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
    <div className="table-scroll">
      <table className="diffs-table">
        <thead>
          <tr>
            <th>Source</th>
            <th>Substantive</th>
            <th>Cosmetic</th>
            <th>Needs review</th>
            <th>Recorded</th>
            <th>Changes</th>
          </tr>
        </thead>
        <tbody>
          {diffs.map((d) => {
            const open = openId === d.id;
            const detail = details[d.id];
            return (
              <Fragment key={d.id}>
                <tr>
                  <td>{d.sourceKey}</td>
                  <td>{d.substantive}</td>
                  <td>{d.cosmetic}</td>
                  <td>{d.needsReview}</td>
                  <td>{formatDate(d.createdAt)}</td>
                  <td>
                    <button
                      type="button"
                      className="link-button"
                      aria-expanded={open}
                      onClick={() => toggle(d.id)}
                    >
                      {open ? "Hide" : "View"}
                    </button>
                  </td>
                </tr>
                {open ? (
                  <tr className="diff-detail-row">
                    <td colSpan={6}>
                      {detail === undefined || detail === "loading" ? (
                        <p className="loading" aria-live="polite">Loading changes…</p>
                      ) : detail === "error" ? (
                        <p className="error">Could not load the change detail.</p>
                      ) : (
                        <ChangeList changes={detail} />
                      )}
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
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
