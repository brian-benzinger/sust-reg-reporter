/**
 * Header navigation primitives — the mobile hamburger menu.
 *
 * Like the theming layer (theme.ts), this has to work on *every* page, including
 * the prerendered content pages that ship no hydration bundle (ADR-0021). So the
 * behaviour cannot live in `app.js`; instead a tiny, dependency-free snippet
 * (`NAV_INIT_SCRIPT`) is inlined into every document and wires the hamburger
 * through event delegation.
 *
 * This module stays DOM-free and pure so it can be unit-tested under the 95/90
 * coverage gate (ADR-0019). The inline script mirrors the same rules in vanilla
 * JS because it must run standalone in the browser with no imports; the shared
 * *strings* (id, attribute names) are threaded through from here so the markup,
 * the stylesheet, and the script cannot drift.
 */

/** id of the <nav> the hamburger controls (its `aria-controls` target). */
export const NAV_ID = "site-nav";

/** Marks the hamburger button(s) for the delegated click handler. */
export const NAV_TOGGLE_ATTR = "data-nav-toggle";

/** Attribute on <html> reflecting whether the mobile menu is open. */
export const NAV_OPEN_ATTR = "data-nav-open";

/**
 * The viewport width (px) at and below which the nav collapses behind the
 * hamburger. Kept here as the single source of truth: the stylesheet uses it as
 * a `max-width` media query and the script watches the matching `min-width`
 * query to auto-close the menu when the layout grows back to the desktop bar.
 */
export const NAV_BREAKPOINT_PX = 832;

/**
 * The inline hamburger script, injected into every document by Layout.
 *
 * Self-contained on purpose: no imports, and uses click delegation so it
 * controls the menu on prerendered pages that never load the hydration bundle.
 * It toggles `NAV_OPEN_ATTR` on <html> (the stylesheet reveals the menu off
 * that), keeps every hamburger's `aria-expanded` in sync, and closes the menu
 * when a link is followed, on Escape, on an outside click, or once the viewport
 * grows past the breakpoint. Built from the constants above so they stay in
 * sync with the markup and CSS.
 */
export const NAV_INIT_SCRIPT = `(function () {
  var NAV_ID = ${JSON.stringify(NAV_ID)};
  var TOGGLE_SELECTOR = "[" + ${JSON.stringify(NAV_TOGGLE_ATTR)} + "]";
  var OPEN_ATTR = ${JSON.stringify(NAV_OPEN_ATTR)};
  var DESKTOP_QUERY = "(min-width: " + ${JSON.stringify(NAV_BREAKPOINT_PX + 1)} + "px)";
  var root = document.documentElement;

  function isOpen() { return root.hasAttribute(OPEN_ATTR); }

  function setOpen(open) {
    if (open) root.setAttribute(OPEN_ATTR, "");
    else root.removeAttribute(OPEN_ATTR);
    var buttons = document.querySelectorAll(TOGGLE_SELECTOR);
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].setAttribute("aria-expanded", open ? "true" : "false");
    }
  }

  // One delegated handler covers the hamburger on every prerendered page.
  document.addEventListener("click", function (event) {
    var target = event.target;
    if (!target || !target.closest) return;
    if (target.closest(TOGGLE_SELECTOR)) { setOpen(!isOpen()); return; }
    if (!isOpen()) return;
    // Close after following a menu link, or when the click lands outside the header.
    if (target.closest("#" + NAV_ID + " a")) { setOpen(false); return; }
    if (!target.closest("header.site")) setOpen(false);
  });

  // Escape closes the menu, matching native disclosure behaviour.
  document.addEventListener("keydown", function (event) {
    if ((event.key === "Escape" || event.key === "Esc") && isOpen()) setOpen(false);
  });

  // Drop the open state once the layout grows back to the full desktop bar, so
  // the attribute never lingers and strand the menu open behind a resize.
  var media = window.matchMedia ? window.matchMedia(DESKTOP_QUERY) : null;
  if (media && media.addEventListener) {
    media.addEventListener("change", function (event) { if (event.matches) setOpen(false); });
  }
})();`;
