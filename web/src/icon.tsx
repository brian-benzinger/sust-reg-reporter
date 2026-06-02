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
