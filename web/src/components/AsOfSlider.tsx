import { useState, useEffect } from "react";
import { type ObligationStatusHistory, ALL_STATUS_HISTORIES } from "@sust-reg/core";
import { collectDates, resolveRows, type TimelineRow } from "../timeline.ts";
import { statusLabel } from "../model.ts";
import { StatusBadge } from "./Badges.tsx";
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
    label: row.status !== undefined ? statusLabel(row.status) : "—",
  };
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

  // Call /api/as-of whenever the selected date strings change (including on mount).
  useEffect(() => {
    setLoading(true);
    fetchAsOf(validOn, knownAsOf)
      .then((data) => {
        if (data.rows !== undefined) {
          setApiRows(data.rows.map(apiRowToTimelineRow));
        }
      })
      .catch(() => {
        setApiRows(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [validOn, knownAsOf]);

  return (
    <>
      <div className="asof-controls">
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

      {loading ? <p className="loading" aria-live="polite">Loading…</p> : null}

      <table className="asof-table">
        <thead>
          <tr>
            <th>Obligation</th>
            <th>Regime</th>
            <th>Status</th>
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
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
