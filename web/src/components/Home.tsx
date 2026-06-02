import type { ReactElement } from "react";
import type { RegimeGroup } from "../model.ts";
import { NOT_LEGAL_ADVICE } from "../content.ts";

/** A single feature in the home-page grid. */
interface Feature {
  readonly href: string;
  readonly title: string;
  readonly blurb: string;
  readonly icon: ReactElement;
}

/* Inline, currentColor line icons — no external requests (ADR-0014). */
const iconProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  focusable: false,
};

const FEATURES: readonly Feature[] = [
  {
    href: "/scope-checker.html",
    title: "Scope checker",
    blurb:
      "The applicability engine made visible: enter a company profile and see which obligations apply, why, and by when.",
    icon: (
      <svg {...iconProps}>
        <circle cx="11" cy="11" r="7" />
        <path d="m21 21-4.3-4.3" />
      </svg>
    ),
  },
  {
    href: "/as-of.html",
    title: "As-of-date slider",
    blurb:
      "The bitemporal model made visible: what was in effect, and what we believed was in effect, on any date.",
    icon: (
      <svg {...iconProps}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    ),
  },
  {
    href: "/diffs.html",
    title: "Change history",
    blurb:
      "Change detection made visible: meaning-aware diffs between consecutive versions of a tracked source.",
    icon: (
      <svg {...iconProps}>
        <path d="M3 6h13M3 6l3-3M3 6l3 3" />
        <path d="M21 18H8m13 0-3-3m3 3-3 3" />
      </svg>
    ),
  },
  {
    href: "/sources.html",
    title: "Tracked sources",
    blurb:
      "The primary regulatory sources the corpus currently ingests, with version counts and ingestion timestamps.",
    icon: (
      <svg {...iconProps}>
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
      </svg>
    ),
  },
];

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
      <section className="hero">
        <span className="eyebrow">
          <span className="dot" />
          Climate disclosure intelligence
        </span>
        <h1>
          Climate disclosure regulations,{" "}
          <span className="grad">version-tracked.</span>
        </h1>
        <p className="lead">
          Primary-source text, exact citations, effective dates, and per-company
          applicability &mdash; with point-in-time history of how each rule
          changed.
        </p>
        <div className="cta-row">
          <a className="btn btn-primary" href="/scope-checker.html">
            Check your scope
          </a>
          <a className="btn btn-ghost" href="/regimes/index.html">
            Browse the regimes &rarr;
          </a>
        </div>
      </section>

      <div className="stat-row">
        <div className="stat">
          <span className="num">{obligationCount}</span>
          <span className="label">obligation(s) across</span>
        </div>
        <div className="stat">
          <span className="num">{props.groups.length}</span>
          <span className="label">regime(s) modeled</span>
        </div>
        <div className="stat">
          <span className="num">2</span>
          <span className="label">time axes (valid + transaction)</span>
        </div>
      </div>

      <div className="notice">{NOT_LEGAL_ADVICE}</div>

      <h2>Explore the corpus</h2>
      <p>
        The corpus currently models {obligationCount} obligation(s) across{" "}
        {props.groups.length} regime(s). Most pages are prerendered to static
        HTML so reads are fast and indexable; the interactive features run in
        your browser against the shared applicability engine.
      </p>
      <div className="feature-grid">
        {FEATURES.map((feature) => (
          <a key={feature.href} className="feature-card" href={feature.href}>
            <span className="ficon">{feature.icon}</span>
            <span className="ftitle">
              {feature.title} <span className="arrow">&rarr;</span>
            </span>
            <p>{feature.blurb}</p>
          </a>
        ))}
      </div>
    </>
  );
}
