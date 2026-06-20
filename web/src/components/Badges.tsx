import type {
  GroundingConfidence,
  GroundingMethod,
  RegulationStatus,
} from "@sust-reg/core";

/** Status pill, styled per lifecycle state (ADR-0006). */
export function StatusBadge(props: {
  readonly status: RegulationStatus;
  readonly label: string;
}): React.ReactElement {
  return <span className={`badge status-${props.status}`}>{props.label}</span>;
}

/** Grounding pill — makes ungrounded seed data visible at a glance (ADR-0004). */
export function GroundedBadge(props: {
  readonly grounded: boolean;
}): React.ReactElement {
  return props.grounded ? (
    <span className="badge grounded">Grounded</span>
  ) : (
    <span className="badge ungrounded">Ungrounded seed data</span>
  );
}

/**
 * The grounding pill plus, when grounded, a confidence chip (ADR-0028,
 * ADR-0017) — the same shape the as-of slider shows, so every surface presents
 * grounding identically. When the grounding is span-level (ADR-0035), it also
 * shows an "exact passage" marker and, where provided, the substantiating
 * `quote` sliced from the snapshot. Surfaces that omit `method`/`quote` (e.g.
 * the compact regimes table) keep the pill-only presentation unchanged.
 */
export function GroundingDisplay(props: {
  readonly grounded: boolean;
  readonly confidence?: GroundingConfidence;
  readonly method?: GroundingMethod;
  readonly quote?: string;
}): React.ReactElement {
  const { grounded, confidence, method, quote } = props;
  return (
    <span className="grounding-cell">
      <GroundedBadge grounded={grounded} />
      {grounded && confidence !== undefined ? (
        <span className={`confidence confidence-${confidence}`}>{confidence}</span>
      ) : null}
      {grounded && method === "span" ? (
        <span
          className="grounding-method"
          title="Pinned to an exact passage in the source snapshot (ADR-0035)"
        >
          exact passage
        </span>
      ) : null}
      {grounded && quote !== undefined ? (
        <q className="grounding-quote">{quote}</q>
      ) : null}
    </span>
  );
}
