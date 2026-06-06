import { useState, useEffect } from "react";
import { type ObligationStatusHistory, ALL_STATUS_HISTORIES } from "@sust-reg/core";
import { collectDates, resolveRows, type TimelineRow } from "../timeline.ts";
import { statusLabel } from "../model.ts";
import { GroundedBadge, StatusBadge } from "./Badges.tsx";
import { fetchAsOf, type AsOfApiRow } from "../api.ts";

/** The id of the element the client hydrates into (shared with prerender). */
export const AS_OF_SLIDER_ROOT_ID = "as-of-slider-root";

/** Clamp a slider index into a non-empty array's bounds. */
function pick(dates: readonly string[], index: number): string {
  const clamped = Math.min(Math.max(index, 0), dates.length - 1);
  return dates[clamped] as string;
}

function apiRowToTimelineRow(row: AsOfApiRow): TimelineRow {
  return {
    obligationId: row.obligationId,
    title: row.title,
    regime: row.regime,
    ...(row.status !== undefined ? { status: row.status } : {}),
    label: row.status !== undefined ? statusLabel(row.status) : "n/a",
    ...(row.grounded !== undefined ? { grounded: row.grounded } : {}),
    ...(row.confidence !== undefined ? { confidence: row.confidence } : {}),
    ...(row.snapshotHash !== undefined ? { snapshotHash: row.snapshotHash } : {}),
    ...(row.retrievedAt !== undefined ? { retrievedAt: row.retrievedAt } : {}),
  };
}

/** A hover tooltip pinning the grounding to its snapshot and retrieval date. */
function provenanceTitle(row: TimelineRow): string | undefined {
  if (row.grounded !== true || row.snapshotHash === undefined) return undefined;
  const retrieved = row.retrievedAt !== undefined ? `, retrieved ${row.retrievedAt}` : "";
  return `Grounded in snapshot ${row.snapshotHash}${retrieved}`;
}

/**
 * The as-of-date slider (ADR-0003 made visible). Renders from seed data on
 * first paint (prerender-compatible), then calls /api/as-of on each slider
 * move so the rows reflect live corpus state.
 */
export function AsOfSlider(props: {
  /** Histories to resolve; defaults to the v1 seed histories (all regimes). */
  readonly histories?: readonly ObligationStatusHistory[];
}): React.ReactElement {
  const histories = props.histories ?? ALL_STATUS_HISTORIES;
  const { validDates, knowledgeDates } = collectDates(histories);

  const [validIdx, setValidIdx] = useState(validDates.length - 1);
  const [knowledgeIdx, setKnowledgeIdx] = useState(knowledgeDates.length - 1);

  if (validDates.length === 0 || knowledgeDates.length === 0) {
    return <p>No timeline data available.</p>;
  }

  const validOn = pick(validDates, validIdx);
  const knownAsOf = pick(knowledgeDates, knowledgeIdx);

  // Seed-computed rows are the initial and fallback state.
  const localRows = resolveRows(histories, { validOn, knownAsOf });
  const [apiRows, setApiRows] = useState<TimelineRow[] | null>(null);
  const [loading, setLoading] = useState(false);

  const rows = apiRows ?? localRows;

  // Call /api/as-of whenever the selected date strings change (including on
  // mount). The indicator is debounced — shown only if the fetch outlasts the
  // delay — so the common fast response updates the rows in place with no
  // flash, and a superseded response (the slider moved again) is ignored so the
  // table never flickers back to stale data.
  useEffect(() => {
    let active = true;
    const showLoading = setTimeout(() => {
      if (active) setLoading(true);
    }, 250);

    fetchAsOf(validOn, knownAsOf)
      .then((data) => {
        if (!active) return;
        if (data.rows !== undefined) {
          setApiRows(data.rows.map(apiRowToTimelineRow));
        }
      })
      .catch(() => {
        if (active) setApiRows(null);
      })
      .finally(() => {
        clearTimeout(showLoading);
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      clearTimeout(showLoading);
    };
  }, [validOn, knownAsOf]);

  return (
    <>
      <div className="asof-controls panel">
        <label>
          In effect on: <strong>{validOn}</strong>
          <input
            type="range"
            min={0}
            max={validDates.length - 1}
            value={Math.min(validIdx, validDates.length - 1)}
            onChange={(e) => setValidIdx(Number(e.target.value))}
          />
        </label>
        <label>
          As we knew it on: <strong>{knownAsOf}</strong>
          <input
            type="range"
            min={0}
            max={knowledgeDates.length - 1}
            value={Math.min(knowledgeIdx, knowledgeDates.length - 1)}
            onChange={(e) => setKnowledgeIdx(Number(e.target.value))}
          />
        </label>
      </div>

      {/* The indicator floats over the table rather than sitting above it, so
          the table never reflows as fetches resolve — no layout shift or
          "jump" when the sliders move (the rows update in place). */}
      <div className="asof-results">
        {loading ? (
          <span className="loading asof-updating" role="status" aria-live="polite">
            Updating…
          </span>
        ) : null}

        <div className="table-scroll">
          <table className="asof-table">
          <thead>
            <tr>
              <th>Obligation</th>
              <th>Regime</th>
              <th>Status</th>
              <th>Grounding</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.obligationId}>
                <td>{row.title}</td>
                <td>{row.regime}</td>
                <td>
                  {row.status !== undefined ? (
                    <StatusBadge status={row.status} label={row.label} />
                  ) : (
                    <span className="muted">{row.label}</span>
                  )}
                </td>
                <td>
                  {/* Empty until the API answers — the seed paint can't know the
                      live grounding state, so we stay neutral rather than flash
                      a misleading "ungrounded" (ADR-0028, invariant #2). */}
                  {row.grounded === undefined ? null : (
                    <span className="grounding-cell" title={provenanceTitle(row)}>
                      <GroundedBadge grounded={row.grounded} />
                      {row.grounded && row.confidence !== undefined ? (
                        <span className={`confidence confidence-${row.confidence}`}>
                          {row.confidence}
                        </span>
                      ) : null}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
