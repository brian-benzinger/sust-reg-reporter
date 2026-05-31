/**
 * Site assembly (ADR-0013): turn the domain corpus into a deterministic set of
 * static files — HTML pages plus the stylesheet — ready to upload to the
 * content store behind CloudFront (ADR-0014).
 *
 * This module is pure: it returns an in-memory list of files and writes
 * nothing. The I/O glue that flushes the list to disk lives in `bin/build.ts`,
 * so the page set itself is fully unit-testable.
 */
import { caRegime, type Obligation } from "@sust-reg/core";
import { STYLESHEET, STYLESHEET_PATH } from "./assets.ts";
import { obligationView, regimeGroups } from "./model.ts";
import {
  layout,
  renderHomePage,
  renderObligationPage,
  renderRegimesIndex,
} from "./render.ts";

export interface SiteFile {
  /** Root-relative output path, e.g. "regimes/index.html". */
  readonly path: string;
  readonly contents: string;
}

/**
 * Build every static file for the given obligations. Order is deterministic
 * (stylesheet, home, regimes index, then one page per obligation in corpus
 * order) so repeated builds produce byte-identical output.
 */
export function buildSite(obligations: readonly Obligation[]): SiteFile[] {
  const groups = regimeGroups(obligations);

  const files: SiteFile[] = [
    { path: STYLESHEET_PATH.replace(/^\//, ""), contents: STYLESHEET },
    {
      path: "index.html",
      contents: layout({
        title: "sust-reg-reporter — climate disclosure regulations, version-tracked",
        description:
          "Version-tracked climate disclosure regulations with primary-source citations, effective dates, and per-company applicability.",
        canonicalPath: "/index.html",
        body: renderHomePage(groups),
      }),
    },
    {
      path: "regimes/index.html",
      contents: layout({
        title: "Regimes — sust-reg-reporter",
        description:
          "Disclosure obligations in the v1 corpus, grouped by regime.",
        canonicalPath: "/regimes/index.html",
        body: renderRegimesIndex(groups),
      }),
    },
  ];

  for (const obligation of obligations) {
    const view = obligationView(obligation);
    files.push({
      path: `regimes/${obligation.id}.html`,
      contents: layout({
        title: `${view.title} — ${view.regime}`,
        description: `${view.regime}: ${view.title}. Status: ${view.statusLabel}.`,
        canonicalPath: view.href,
        body: renderObligationPage(view),
      }),
    });
  }

  return files;
}

/** The default corpus served by the site: the v1 seed obligations (ADR-0009). */
export function defaultCorpus(): readonly Obligation[] {
  return caRegime.CALIFORNIA_OBLIGATIONS;
}

/** Convenience: build the site from the default seed corpus. */
export function buildDefaultSite(): SiteFile[] {
  return buildSite(defaultCorpus());
}
