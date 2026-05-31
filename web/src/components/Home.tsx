import type { RegimeGroup } from "../model.ts";
import { NOT_LEGAL_ADVICE } from "../content.ts";

/** Landing page: product overview, corpus size, and the interactive features. */
export function Home(props: {
  readonly groups: readonly RegimeGroup[];
}): React.ReactElement {
  const obligationCount = props.groups.reduce(
    (sum, g) => sum + g.obligations.length,
    0,
  );

  return (
    <>
      <h1>Climate disclosure regulations, version-tracked.</h1>
      <p className="lead">
        Primary-source text, exact citations, effective dates, and per-company
        applicability &mdash; with point-in-time history of how each rule
        changed.
      </p>
      <div className="notice">{NOT_LEGAL_ADVICE}</div>
      <p>
        The corpus currently models {obligationCount} obligation(s) across{" "}
        {props.groups.length} regime(s).{" "}
        <a href="/regimes/index.html">Browse the regimes &rarr;</a>
      </p>
      <h2>Interactive features</h2>
      <p>
        Most pages are prerendered to static HTML so reads are fast and
        indexable. The interactive features run in your browser against the
        shared applicability engine:
      </p>
      <ul className="feature-list">
        <li>
          <strong>
            <a href="/scope-checker.html">Scope checker</a>
          </strong>{" "}
          &mdash; the applicability engine made visible: enter a company
          profile, see which obligations apply and by when.
        </li>
        <li>
          <strong>
            <a href="/as-of.html">As-of-date slider</a>
          </strong>{" "}
          &mdash; the bitemporal model made visible: what was in effect, and
          what we believed was in effect, on any date.
        </li>
        <li>
          <strong>Diff view</strong> &mdash; change detection made visible:
          meaning-aware diffs between versions of a source.{" "}
          <span className="soon">(coming soon)</span>
        </li>
      </ul>
    </>
  );
}
