/**
 * The header hamburger button (mobile navigation).
 *
 * A single real <button> that opens and closes the collapsed nav on narrow
 * viewports. Like the theme toggle, it stays a static, dependency-free shell:
 * the inline init script (nav.ts) owns the click behaviour via delegation, so
 * even the no-hydration content pages get a working menu. CSS hides it entirely
 * on the wide layout, where the full nav bar is shown instead.
 */
import type { ReactElement } from "react";
import { MenuIcon } from "../icon.tsx";
import { NAV_ID, NAV_TOGGLE_ATTR } from "../nav.ts";

export function NavToggle(): ReactElement {
  return (
    <button
      type="button"
      className="nav-toggle"
      aria-label="Menu"
      aria-controls={NAV_ID}
      aria-expanded="false"
      {...{ [NAV_TOGGLE_ATTR]: "" }}
    >
      <MenuIcon />
    </button>
  );
}
