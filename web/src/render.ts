/**
 * HTML rendering for the static site (ADR-0013).
 *
 * Pure string templating — no framework, no runtime dependencies (ADR-0020).
 * Every piece of dynamic text passes through `escapeHtml`, and the layout
 * carries the "not legal advice" notice on every page so the non-interpretive
 * posture (ADR-0002) is never lost regardless of which page is indexed or
 * deep-linked.
 */
import { STYLESHEET_PATH } from "./assets.ts";
import type {
  CitationView,
  ObligationView,
  RegimeGroup,
} from "./model.ts";

/** The standing, page-level disclaimer (ADR-0002). */
export const NOT_LEGAL_ADVICE =
  "Not legal advice. This site returns primary-source text, citations, " +
  "effective dates, and applicability metadata only. Verify against the cited " +
  "source and consult qualified counsel.";

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** Escape text for safe interpolation into HTML element/attribute content. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] as string);
}

export interface LayoutOptions {
  readonly title: string;
  readonly description?: string;
  readonly canonicalPath?: string;
  /** Pre-rendered, already-escaped inner HTML for <main>. */
  readonly body: string;
}

/** Wrap page body in the shared document shell: head, header nav, footer. */
export function layout(options: LayoutOptions): string {
  const { title, description, canonicalPath, body } = options;
  const descriptionMeta =
    description !== undefined
      ? `\n    <meta name="description" content="${escapeHtml(description)}" />`
      : "";
  const canonical =
    canonicalPath !== undefined
      ? `\n    <link rel="canonical" href="${escapeHtml(canonicalPath)}" />`
      : "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>${descriptionMeta}${canonical}
    <link rel="stylesheet" href="${STYLESHEET_PATH}" />
  </head>
  <body>
    <header class="site">
      <div class="wrap">
        <a class="brand" href="/index.html">sust&#8209;reg&#8209;reporter</a>
        <nav>
          <a href="/index.html">Home</a>
          <a href="/regimes/index.html">Regimes</a>
        </nav>
      </div>
    </header>
    <main>
      <div class="wrap">
${body}
      </div>
    </main>
    <footer class="site">
      <div class="wrap">
        <p><strong>${escapeHtml(NOT_LEGAL_ADVICE)}</strong></p>
        <p>Version-tracked climate disclosure regulations &middot; primary-source pinned.</p>
      </div>
    </footer>
  </body>
</html>
`;
}

/** Status pill, styled per lifecycle state (ADR-0006). */
export function statusBadge(view: ObligationView): string {
  return `<span class="badge status-${escapeHtml(view.status)}">${escapeHtml(view.statusLabel)}</span>`;
}

/** Grounding pill — makes ungrounded seed data visible at a glance (ADR-0004). */
export function groundedBadge(citation: CitationView): string {
  return citation.grounded
    ? '<span class="badge grounded">Grounded</span>'
    : '<span class="badge ungrounded">Ungrounded seed data</span>';
}

function factsList(facts: readonly string[]): string {
  const items = facts
    .map((f) => `          <li>${escapeHtml(f)}</li>`)
    .join("\n");
  return `        <ul class="facts">\n${items}\n        </ul>`;
}

/** Landing page: product overview, the three interactive features, regimes link. */
export function renderHomePage(groups: readonly RegimeGroup[]): string {
  const obligationCount = groups.reduce(
    (sum, g) => sum + g.obligations.length,
    0,
  );

  return `        <h1>Climate disclosure regulations, version-tracked.</h1>
        <p class="lead">
          Primary-source text, exact citations, effective dates, and
          per-company applicability &mdash; with point-in-time history of how
          each rule changed.
        </p>
        <div class="notice">${escapeHtml(NOT_LEGAL_ADVICE)}</div>
        <p>
          The corpus currently models ${obligationCount} obligation(s) across
          ${groups.length} regime(s).
          <a href="/regimes/index.html">Browse the regimes &rarr;</a>
        </p>
        <h2>Interactive features</h2>
        <p>
          Most pages are statically generated so reads are fast and indexable.
          Three features surface the engineering depth and are served by a thin
          live API:
        </p>
        <ul class="feature-list">
          <li>
            <strong>As-of-date slider</strong> &mdash; the bitemporal model made
            visible: what was in effect, and what we believed was in effect, on
            any date. <span class="soon">(API &mdash; coming soon)</span>
          </li>
          <li>
            <strong>Scope checker</strong> &mdash; the applicability engine made
            visible: enter a company profile, see which obligations apply and by
            when. <span class="soon">(API &mdash; coming soon)</span>
          </li>
          <li>
            <strong>Diff view</strong> &mdash; change detection made visible:
            meaning-aware diffs between versions of a source.
            <span class="soon">(API &mdash; coming soon)</span>
          </li>
        </ul>`;
}

function obligationCard(view: ObligationView): string {
  return `          <article class="card">
            <h3><a href="${escapeHtml(view.href)}">${escapeHtml(view.title)}</a></h3>
            <p class="meta">${escapeHtml(view.regime)} &middot; ${statusBadge(view)} &middot; ${groundedBadge(view.citation)}</p>
          </article>`;
}

/** Regimes index: every obligation, grouped by regime. */
export function renderRegimesIndex(groups: readonly RegimeGroup[]): string {
  const sections = groups
    .map((group) => {
      const cards = group.obligations.map(obligationCard).join("\n");
      return `        <section>
          <h2>${escapeHtml(group.regime)}</h2>
${cards}
        </section>`;
    })
    .join("\n");

  return `        <h1>Regimes</h1>
        <p class="lead">Disclosure obligations in the v1 corpus, grouped by regime.</p>
${sections}`;
}

/** Per-obligation detail page. */
export function renderObligationPage(view: ObligationView): string {
  const deadlineRow =
    view.firstReportingDeadline !== undefined
      ? `\n          <dt>First reporting deadline</dt>
          <dd>${escapeHtml(view.firstReportingDeadline)}</dd>`
      : "";

  const sourceLink =
    view.citation.sourceUrl !== undefined
      ? `\n          <dt>Source</dt>
          <dd><a href="${escapeHtml(view.citation.sourceUrl)}" rel="nofollow noopener" target="_blank">${escapeHtml(view.citation.sourceUrl)}</a></dd>`
      : "";

  const retrievedRow =
    view.citation.retrievedAt !== undefined
      ? `\n          <dt>Retrieved</dt>
          <dd>${escapeHtml(view.citation.retrievedAt)}</dd>`
      : "";

  return `        <p class="meta"><a href="/regimes/index.html">&larr; Regimes</a></p>
        <h1>${escapeHtml(view.title)}</h1>
        <p class="lead">${escapeHtml(view.regime)} &middot; ${statusBadge(view)}</p>
        <dl class="kv">
          <dt>Status</dt>
          <dd>${escapeHtml(view.statusLabel)} &mdash; ${escapeHtml(view.statusDescription)}</dd>${deadlineRow}
        </dl>
        <h2>Applicability</h2>
${factsList(view.criteriaFacts)}
        <h2>Citation</h2>
        <p>${groundedBadge(view.citation)}</p>
        <dl class="kv">
          <dt>Reference</dt>
          <dd>${escapeHtml(view.citation.label)}</dd>${sourceLink}${retrievedRow}
        </dl>`;
}
