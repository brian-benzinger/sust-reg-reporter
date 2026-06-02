/**
 * The header theme control (ADR-0029).
 *
 * A single real <button> that cycles System → Light → Dark. It carries all
 * three glyphs in the prerendered markup; CSS shows exactly one based on the
 * `data-theme-pref` attribute the inline init script sets on <html> before
 * paint, so the right icon is correct on first render with no JavaScript work
 * on the page itself. The inline script (theme.ts) owns the click behaviour via
 * delegation, which is why this stays a static, dependency-free shell that even
 * the no-hydration content pages can use.
 */
import type { ReactElement } from "react";
import { THEME_TOGGLE_ATTR } from "../theme.ts";

/** Sun — the Light preference. */
function SunIcon(): ReactElement {
  return (
    <svg
      className="ti ti-light"
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
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

/** Moon — the Dark preference. */
function MoonIcon(): ReactElement {
  return (
    <svg
      className="ti ti-dark"
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
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
    </svg>
  );
}

/** Monitor — the System (follow-OS) preference. */
function SystemIcon(): ReactElement {
  return (
    <svg
      className="ti ti-system"
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
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
}

/**
 * The toggle button. Defaults its accessible name to the "system" state, which
 * matches the server-rendered icon; the inline script keeps the label in sync
 * with the live preference once the page is interactive.
 */
export function ThemeToggle(): ReactElement {
  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label="Theme: System (activate to change)"
      title="Theme: System"
      {...{ [THEME_TOGGLE_ATTR]: "" }}
    >
      <SystemIcon />
      <SunIcon />
      <MoonIcon />
    </button>
  );
}
