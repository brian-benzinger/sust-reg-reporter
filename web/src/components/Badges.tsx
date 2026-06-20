import type { GroundingConfidence, RegulationStatus } from "@sust-reg/core";

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
 * The grounding pill plus, when grounded, a confidence chip and a small "ⓘ"
 * link to the methodology definitions (ADR-0028, ADR-0017) — the same shape
 * every surface shows. When a span-level grounding provides the substantiating
 * `quote` (ADR-0035), it is rendered, labelled, on its own line. Surfaces that
 * omit `quote` (e.g. the compact regimes table) keep the pill-only line.
 */
export function GroundingDisplay(props: {
  readonly grounded: boolean;
  readonly confidence?: GroundingConfidence;
  readonly quote?: string;
}): React.ReactElement {
  const { grounded, confidence, quote } = props;
  return (
    <>
      <span className="grounding-cell">
        <GroundedBadge grounded={grounded} />
        {grounded && confidence !== undefined ? (
          <span
            className={`confidence confidence-${confidence}`}
            title="How confident we are in the grounding match"
          >
            {confidence}
          </span>
        ) : null}
        {grounded ? (
          <a
            className="info-link"
            href="/methodology.html#grounding"
            title="What do grounded, confidence, and source text mean?"
            aria-label="What grounding and confidence mean"
          >
            ⓘ
          </a>
        ) : null}
      </span>
      {grounded && quote !== undefined ? (
        <span className="grounding-quote">
          <span className="grounding-quote-label">Source text</span>
          <q>{quote}</q>
        </span>
      ) : null}
    </>
  );
}
