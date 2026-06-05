/**
 * The page manifest (ADR-0013): a deterministic list of every page the site
 * prerenders, each as a React node plus its metadata. Pure — it builds nodes
 * and performs no I/O, so the prerender entry (prerender.tsx) stays thin glue.
 */
import type { ReactNode } from "react";
import { ALL_OBLIGATIONS, type Obligation } from "@sust-reg/core";
import { obligationView, regimeGroups } from "./model.ts";
import { AsOfSliderPage } from "./components/AsOfSliderPage.tsx";
import { DiffsPage } from "./components/DiffsPage.tsx";
import { Home } from "./components/Home.tsx";
import { MethodologyPage } from "./components/MethodologyPage.tsx";
import { ObligationPage } from "./components/ObligationPage.tsx";
import { RegimesIndex } from "./components/RegimesIndex.tsx";
import { REGIMES_ROOT_ID } from "./components/RegimesIsland.tsx";
import { ScopeCheckerPage } from "./components/ScopeCheckerPage.tsx";
import { SourcesPage } from "./components/SourcesPage.tsx";
import { StatusStatesPage } from "./components/StatusStatesPage.tsx";

export interface PageSpec {
  /** Root-relative output path, e.g. "regimes/index.html". */
  readonly path: string;
  readonly title: string;
  readonly description: string;
  readonly canonicalPath: string;
  /** Whether the page needs the hydration bundle. */
  readonly withClient: boolean;
  readonly node: ReactNode;
}

/** Build the full page set for the given obligations. */
export function buildPages(obligations: readonly Obligation[]): PageSpec[] {
  const groups = regimeGroups(obligations);

  const pages: PageSpec[] = [
    {
      path: "index.html",
      title:
        "DiscloseLab · climate disclosure regulations, version-tracked",
      description:
        "Version-tracked climate disclosure regulations with primary-source citations, effective dates, and per-company applicability.",
      canonicalPath: "/index.html",
      withClient: false,
      node: <Home groups={groups} />,
    },
    {
      path: "regimes/index.html",
      title: "Regimes · DiscloseLab",
      description: "Disclosure obligations in the v1 corpus, grouped by regime.",
      canonicalPath: "/regimes/index.html",
      // Hydrated to overlay live grounding (ADR-0028); the prerendered markup
      // inside the mount matches the island's first (seed) render.
      withClient: true,
      node: (
        <div id={REGIMES_ROOT_ID}>
          <RegimesIndex groups={groups} />
        </div>
      ),
    },
    {
      path: "scope-checker.html",
      title: "Scope checker · DiscloseLab",
      description:
        "Enter a company profile to see which modeled disclosure obligations apply and by when.",
      canonicalPath: "/scope-checker.html",
      withClient: true,
      node: <ScopeCheckerPage />,
    },
    {
      path: "as-of.html",
      title: "As-of-date slider · DiscloseLab",
      description:
        "See what was in effect on a given date, and what we believed was in effect as of a chosen knowledge date.",
      canonicalPath: "/as-of.html",
      withClient: true,
      node: <AsOfSliderPage />,
    },
    {
      path: "sources.html",
      title: "Tracked sources · DiscloseLab",
      description:
        "Primary regulatory sources tracked by the corpus, with version counts and ingestion timestamps.",
      canonicalPath: "/sources.html",
      withClient: true,
      node: <SourcesPage />,
    },
    {
      path: "diffs.html",
      title: "Change history · DiscloseLab",
      description:
        "Meaning-aware diffs between consecutive versions of tracked regulatory sources, produced by semdiff.",
      canonicalPath: "/diffs.html",
      withClient: true,
      node: <DiffsPage />,
    },
    {
      path: "status-states.html",
      title: "Regulation status states · DiscloseLab",
      description:
        "What the proposed, in-effect, enforced, and stayed status states mean, and why a law can be on the books while its enforcement is paused.",
      canonicalPath: "/status-states.html",
      withClient: false,
      node: <StatusStatesPage />,
    },
    {
      path: "methodology.html",
      title: "Methodology · DiscloseLab",
      description:
        "How the corpus is built and grounded: primary-source citations, point-in-time history, authoritative-source ingestion, and the limits to hold it to.",
      canonicalPath: "/methodology.html",
      withClient: false,
      node: <MethodologyPage />,
    },
  ];

  for (const obligation of obligations) {
    const view = obligationView(obligation);
    pages.push({
      path: `regimes/${obligation.id}.html`,
      title: `${view.title} · ${view.regime}`,
      description: `${view.regime}: ${view.title}. Status: ${view.statusLabel}.`,
      canonicalPath: view.href,
      // Hydrated to overlay live grounding on the citation badge (ADR-0028).
      withClient: true,
      node: <ObligationPage view={view} />,
    });
  }

  return pages;
}

/** The default corpus served by the site: all three v1 regimes (ADR-0009). */
export function defaultCorpus(): readonly Obligation[] {
  return ALL_OBLIGATIONS;
}
