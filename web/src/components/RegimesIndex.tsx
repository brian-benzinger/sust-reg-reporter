import type { ObligationView, RegimeGroup } from "../model.ts";
import { GroundedBadge, StatusBadge } from "./Badges.tsx";

function ObligationCard(props: {
  readonly view: ObligationView;
}): React.ReactElement {
  const { view } = props;
  return (
    <article className="card">
      <h3>
        <a href={view.href}>{view.title}</a>
      </h3>
      <p className="meta">
        {view.regime} &middot;{" "}
        <StatusBadge status={view.status} label={view.statusLabel} />{" "}
        &middot; <GroundedBadge grounded={view.citation.grounded} />
      </p>
    </article>
  );
}

/** Regimes index: every obligation, grouped by regime. */
export function RegimesIndex(props: {
  readonly groups: readonly RegimeGroup[];
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
            {group.obligations.map((view) => (
              <ObligationCard key={view.id} view={view} />
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
