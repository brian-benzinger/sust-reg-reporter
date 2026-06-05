import type { ObligationView, RegimeGroup } from "../model.ts";
import type { GroundingApiRow } from "../api.ts";
import type { GroundingIndex } from "../grounding.ts";
import { GroundingDisplay, StatusBadge } from "./Badges.tsx";

function ObligationCard(props: {
  readonly view: ObligationView;
  /** Live grounding for this obligation, if the corpus has grounded it. */
  readonly grounding?: GroundingApiRow;
}): React.ReactElement {
  const { view, grounding } = props;
  // Live DB grounding wins over the (ungrounded) seed citation when present.
  const grounded = grounding?.grounded ?? view.citation.grounded;
  return (
    <article className="card">
      <h3>
        <a href={view.href}>{view.title}</a>
      </h3>
      <p className="meta">
        {view.regime} &middot;{" "}
        <StatusBadge status={view.status} label={view.statusLabel} />{" "}
        &middot;{" "}
        <GroundingDisplay
          grounded={grounded}
          {...(grounding?.confidence !== undefined
            ? { confidence: grounding.confidence }
            : {})}
        />
      </p>
    </article>
  );
}

/**
 * Regimes index: every obligation, grouped by regime. `groundings` overlays the
 * live grounding from `/api/grounding` (ADR-0028); without it (the static
 * prerender, first paint) each card shows its seed citation's grounding state.
 */
export function RegimesIndex(props: {
  readonly groups: readonly RegimeGroup[];
  readonly groundings?: GroundingIndex;
}): React.ReactElement {
  return (
    <>
      <h1>Regimes</h1>
      <p className="lead">
        Disclosure obligations in the v1 corpus, grouped by regime.
      </p>
      {props.groups.map((group) => (
        <section key={group.regime}>
          <h2>{group.regime}</h2>
          <div className="card-grid">
            {group.obligations.map((view) => {
              const grounding = props.groundings?.get(view.id);
              return (
                <ObligationCard
                  key={view.id}
                  view={view}
                  {...(grounding !== undefined ? { grounding } : {})}
                />
              );
            })}
          </div>
        </section>
      ))}
    </>
  );
}
