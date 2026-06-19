/**
 * The site's leaf mark — a small sustainability glyph used as the favicon and
 * alongside the brand name in the header.
 *
 * The geometry lives here once and feeds two consumers: a standalone SVG
 * document string the prerender step writes to dist/ as the favicon, and an
 * inline React component for the header. Like the stylesheet (styles.ts) it
 * ships as one cacheable, self-contained asset behind CloudFront — system
 * colors, no external requests, and crisp at every size (ADR-0014).
 */
import type { ReactElement } from "react";

/** Root-relative URL of the favicon emitted by the prerender step. */
export const FAVICON_PATH = "/leaf.svg";

/** Sustainability green — mirrors --ok in styles.ts. */
const LEAF_GREEN = "#1a7f37";

/** Outer leaf blade. */
const LEAF_BLADE =
  "M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z";
/** The midrib vein sweeping into the blade. */
const LEAF_VEIN = "M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12";

/**
 * Standalone favicon document. Green stroke with a faint fill so the leaf reads
 * at favicon sizes against either a light or dark browser chrome.
 */
export const FAVICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" ' +
  `fill="none" stroke="${LEAF_GREEN}" stroke-width="2" ` +
  'stroke-linecap="round" stroke-linejoin="round">' +
  `<path d="${LEAF_BLADE}" fill="${LEAF_GREEN}" fill-opacity="0.15"/>` +
  `<path d="${LEAF_VEIN}"/>` +
  "</svg>\n";

/**
 * Inline leaf mark for the header. Inherits its color from CSS (currentColor)
 * so the stylesheet, not the markup, owns the palette; decorative, so it is
 * hidden from assistive tech and the adjacent brand text carries the name.
 */
export function LeafIcon(): ReactElement {
  return (
    <svg
      className="leaf-icon"
      viewBox="0 0 24 24"
      width="1.25em"
      height="1.25em"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={LEAF_BLADE} />
      <path d={LEAF_VEIN} />
    </svg>
  );
}

/**
 * Hamburger mark for the mobile menu button. Inherits its color from CSS
 * (currentColor); decorative, so it is hidden from assistive tech — the
 * button's `aria-label` names the control. CSS swaps it for a close affordance
 * via the open-state attribute, so a single static glyph serves both states.
 */
export function MenuIcon(): ReactElement {
  return (
    <svg
      className="menu-icon"
      viewBox="0 0 24 24"
      width="1.3em"
      height="1.3em"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M3 6h18M3 12h18M3 18h18" />
    </svg>
  );
}

/**
 * Magnifying-glass mark for the header search control. Inherits its color from
 * CSS (currentColor); decorative, so it is hidden from assistive tech — the
 * link's `aria-label` names the destination.
 */
export function SearchIcon(): ReactElement {
  return (
    <svg
      className="search-icon"
      viewBox="0 0 24 24"
      width="1.15em"
      height="1.15em"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}

/** GitHub mark (Simple Icons geometry). */
const GITHUB_PATH =
  "M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222 0 1.606-.015 2.898-.015 3.293 0 .322.218.694.825.576C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12";

/** LinkedIn mark (Simple Icons geometry). */
const LINKEDIN_PATH =
  "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.225 0z";

/**
 * A filled brand glyph for the footer social links. Inherits its color from CSS
 * (currentColor); decorative, so it is hidden from assistive tech — the link's
 * `aria-label` names the destination.
 */
function BrandMark(props: { readonly path: string }): ReactElement {
  return (
    <svg
      className="social-icon"
      viewBox="0 0 24 24"
      width="1.15em"
      height="1.15em"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d={props.path} />
    </svg>
  );
}

export function GitHubIcon(): ReactElement {
  return <BrandMark path={GITHUB_PATH} />;
}

export function LinkedInIcon(): ReactElement {
  return <BrandMark path={LINKEDIN_PATH} />;
}
