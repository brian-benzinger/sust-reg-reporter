import { useState } from "react";
import { type ObligationStatusHistory, caRegime } from "@sust-reg/core";
import { collectDates, resolveRows } from "../timeline.ts";
import { StatusBadge } from "./Badges.tsx";

/** The id of the element the client hydrates into (shared with prerender). */
export const AS_OF_SLIDER_ROOT_ID = "as-of-slider-root";

/** Clamp a slider index into a non-empty array's bounds. */
function pick(dates: readonly string[], index: number): string {
  const clamped = Math.min(Math.max(index, 0), dates.length - 1);
  return dates[clamped] as string;
}

/**
 * The as-of-date slider (ADR-0003 made visible). Two controls — a valid-time
 * date and a transaction-time ("as we knew it") date — drive a live resolution
 * of each obligation's status. Defaults to the most recent of each so the
 * prerendered HTML and the hydrated client agree on the initial render.
 */
export function AsOfSlider(props: {
  /** Histories to resolve; defaults to the v1 California seed histories. */
  readonly histories?: readonly ObligationStatusHistory[];
}): React.ReactElement {
  const histories = props.histories ?? caRegime.CALIFORNIA_STATUS_HISTORIES;
  const { validDates, knowledgeDates } = collectDates(histories);

  const [validIdx, setValidIdx] = useState(validDates.length - 1);
  const [knowledgeIdx, setKnowledgeIdx] = useState(knowledgeDates.length - 1);

  if (validDates.length === 0 || knowledgeDates.length === 0) {
    return <p>No timeline data available.</p>;
  }

  const validOn = pick(validDates, validIdx);
  const knownAsOf = pick(knowledgeDates, knowledgeIdx);
  const rows = resolveRows(histories, { validOn, knownAsOf });

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
