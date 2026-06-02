/**
 * Light/dark theming primitives (ADR-0029).
 *
 * The site is prerendered to static HTML and most pages ship no hydration
 * bundle (ADR-0021), yet the theme toggle has to work on *every* page — so the
 * theming cannot live in `app.js`. Instead a tiny, dependency-free snippet
 * (`THEME_INIT_SCRIPT`) is inlined into every document's <head>: it applies the
 * stored/system theme before first paint (no flash of the wrong theme) and
 * wires the toggle through event delegation.
 *
 * This module stays DOM-free and pure so it can be unit-tested under the 95/90
 * coverage gate (ADR-0019). The inline script mirrors the same small rules in
 * vanilla JS because it must run standalone in the browser with no imports; the
 * shared *strings* (storage key, attribute names) are threaded through from
 * here so the two cannot drift.
 */

/** Attribute on <html> holding the *resolved* theme the CSS reacts to. */
export const THEME_ATTR = "data-theme";

/** Attribute on <html> holding the *preference* (drives the toggle's icon). */
export const THEME_PREF_ATTR = "data-theme-pref";

/** localStorage key persisting the user's explicit choice across visits. */
export const THEME_STORAGE_KEY = "srr-theme";

/** Marks the toggle button(s) for the delegated click handler. */
export const THEME_TOGGLE_ATTR = "data-theme-toggle";

/** What the user can choose: follow the OS, or pin a mode. */
export type ThemePreference = "system" | "light" | "dark";

/** What actually gets painted once "system" is resolved against the OS. */
export type ResolvedTheme = "light" | "dark";

/**
 * Cycle order for the toggle. "system" first so the default state (follow the
 * OS) is where a fresh visitor starts and returns to.
 */
export const THEME_PREFERENCES: readonly ThemePreference[] = [
  "system",
  "light",
  "dark",
];

const PREFERENCE_LABELS: Readonly<Record<ThemePreference, string>> = {
  system: "System",
  light: "Light",
  dark: "Dark",
};

/** Narrow an untrusted string (e.g. from localStorage) to a known preference. */
export function isThemePreference(value: unknown): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

/** Human label for a preference, used in the toggle's accessible name. */
export function preferenceLabel(preference: ThemePreference): string {
  return PREFERENCE_LABELS[preference];
}

/** Next preference in the cycle (system → light → dark → system). */
export function nextPreference(current: ThemePreference): ThemePreference {
  const index = THEME_PREFERENCES.indexOf(current);
  // `(index + 1) % length` is always a valid index (an unknown `current` gives
  // index -1 → 0 → "system"), so the lookup is never undefined; the cast just
  // discharges `noUncheckedIndexedAccess` without an unreachable fallback.
  return THEME_PREFERENCES[
    (index + 1) % THEME_PREFERENCES.length
  ] as ThemePreference;
}

/** Resolve a preference to a concrete theme given the OS dark-mode signal. */
export function resolvePreference(
  preference: ThemePreference,
  prefersDark: boolean,
): ResolvedTheme {
  if (preference === "system") {
    return prefersDark ? "dark" : "light";
  }
  return preference;
}

/**
 * The inline pre-paint + toggle script, injected into every <head> by Layout.
 *
 * Self-contained on purpose: no imports, guards every storage/`matchMedia`
 * access so private-mode or older browsers degrade gracefully, and uses click
 * delegation so it controls the toggle on prerendered pages that never load the
 * hydration bundle. Built from the constants above so the strings stay in sync.
 */
export const THEME_INIT_SCRIPT = `(function () {
  var STORAGE_KEY = ${JSON.stringify(THEME_STORAGE_KEY)};
  var THEME_ATTR = ${JSON.stringify(THEME_ATTR)};
  var PREF_ATTR = ${JSON.stringify(THEME_PREF_ATTR)};
  var TOGGLE_SELECTOR = "[" + ${JSON.stringify(THEME_TOGGLE_ATTR)} + "]";
  var PREFS = ${JSON.stringify(THEME_PREFERENCES)};
  var root = document.documentElement;
  var media = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;

  function prefersDark() { return !!(media && media.matches); }

  function readPreference() {
    try {
      var stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "light" || stored === "dark" || stored === "system") return stored;
    } catch (e) {}
    return "system";
  }

  function storePreference(pref) {
    try { localStorage.setItem(STORAGE_KEY, pref); } catch (e) {}
  }

  function resolve(pref) {
    if (pref === "system") return prefersDark() ? "dark" : "light";
    return pref;
  }

  function label(pref) { return pref.charAt(0).toUpperCase() + pref.slice(1); }

  function syncButtons(pref) {
    var name = "Theme: " + label(pref) + " (activate to change)";
    var buttons = document.querySelectorAll(TOGGLE_SELECTOR);
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].setAttribute("aria-label", name);
      buttons[i].setAttribute("title", "Theme: " + label(pref));
    }
  }

  function apply(pref) {
    root.setAttribute(THEME_ATTR, resolve(pref));
    root.setAttribute(PREF_ATTR, pref);
    root.style.colorScheme = resolve(pref);
    syncButtons(pref);
  }

  // Pre-paint: set the theme before the first frame to avoid a flash.
  apply(readPreference());

  // One delegated handler covers the toggle on every prerendered page.
  document.addEventListener("click", function (event) {
    var target = event.target && event.target.closest ? event.target.closest(TOGGLE_SELECTOR) : null;
    if (!target) return;
    var next = PREFS[(PREFS.indexOf(readPreference()) + 1) % PREFS.length] || "system";
    storePreference(next);
    apply(next);
  });

  // Track the OS while the preference is "system".
  if (media && media.addEventListener) {
    media.addEventListener("change", function () {
      if (readPreference() === "system") apply("system");
    });
  }

  // The head script runs before the toggle is parsed; label it once it exists.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { syncButtons(readPreference()); });
  } else {
    syncButtons(readPreference());
  }
})();`;
