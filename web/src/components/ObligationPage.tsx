import type { ObligationView } from "../model.ts";
import { GroundingDisplay, StatusBadge } from "./Badges.tsx";
import { OBLIGATION_GROUNDING_ROOT_ID } from "./ObligationGroundingBadge.tsx";

/** Per-obligation detail page. */
export function ObligationPage(props: {
  readonly view: ObligationView;
}): React.ReactElement {
  const { view } = props;
  return (
    <>
      <p className="meta">
        <a href="/regimes/index.html">&larr; Regimes</a>
      </p>
      <h1>{view.title}</h1>
      <p className="lead">
        {view.regime} &middot;{" "}
        <StatusBadge status={view.status} label={view.statusLabel} />
      </p>
      <dl className="kv">
        <dt>Status</dt>
        <dd>
          {view.statusLabel} &mdash; {view.statusDescription}
        </dd>
        {view.firstReportingDeadline !== undefined ? (
          <>
            <dt>First reporting deadline</dt>
            <dd>{view.firstReportingDeadline}</dd>
          </>
        ) : null}
      </dl>
      <h2>Applicability</h2>
      <ul className="facts">
        {view.criteriaFacts.map((fact) => (
          <li key={fact}>{fact}</li>
        ))}
      </ul>
      <h2>Citation</h2>
      {/* Hydrated in place: prerenders the seed citation's grounding, then
          overlays the live grounding for this obligation (ADR-0028). The id and
          data attribute let the client entry mount the island with no props. */}
      <p id={OBLIGATION_GROUNDING_ROOT_ID} data-obligation-id={view.id}>
        <GroundingDisplay grounded={view.citation.grounded} />
      </p>
      <dl className="kv">
        <dt>Reference</dt>
        <dd>{view.citation.label}</dd>
        {view.citation.sourceUrl !== undefined ? (
          <>
            <dt>Source</dt>
            <dd>
              <a
                href={view.citation.sourceUrl}
                rel="nofollow noopener"
                target="_blank"
              >
                {view.citation.sourceUrl}
              </a>
            </dd>
          </>
        ) : null}
        {view.citation.retrievedAt !== undefined ? (
          <>
            <dt>Retrieved</dt>
            <dd>{view.citation.retrievedAt}</dd>
          </>
        ) : null}
      </dl>
    </>
  );
}
