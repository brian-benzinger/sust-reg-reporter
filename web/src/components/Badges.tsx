import type { RegulationStatus } from "@sust-reg/core";

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
