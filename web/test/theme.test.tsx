import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  THEME_ATTR,
  THEME_INIT_SCRIPT,
  THEME_PREFERENCES,
  THEME_PREF_ATTR,
  THEME_STORAGE_KEY,
  THEME_TOGGLE_ATTR,
  isThemePreference,
  nextPreference,
  preferenceLabel,
  resolvePreference,
  type ThemePreference,
} from "../src/theme.ts";
import { ThemeToggle } from "../src/components/ThemeToggle.tsx";
import { Layout } from "../src/components/Layout.tsx";

describe("isThemePreference", () => {
  it("accepts the three known preferences", () => {
    expect(isThemePreference("system")).toBe(true);
    expect(isThemePreference("light")).toBe(true);
    expect(isThemePreference("dark")).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isThemePreference("sepia")).toBe(false);
    expect(isThemePreference(null)).toBe(false);
    expect(isThemePreference(undefined)).toBe(false);
    expect(isThemePreference(2)).toBe(false);
  });
});

describe("preferenceLabel", () => {
  it("gives a capitalized label for each preference", () => {
    expect(preferenceLabel("system")).toBe("System");
    expect(preferenceLabel("light")).toBe("Light");
    expect(preferenceLabel("dark")).toBe("Dark");
  });
});

describe("nextPreference", () => {
  it("cycles system -> light -> dark -> system", () => {
    expect(nextPreference("system")).toBe("light");
    expect(nextPreference("light")).toBe("dark");
    expect(nextPreference("dark")).toBe("system");
  });

  it("visits every preference exactly once per full cycle", () => {
    const seen: ThemePreference[] = [];
    let current: ThemePreference = "system";
    for (let i = 0; i < THEME_PREFERENCES.length; i++) {
      seen.push(current);
      current = nextPreference(current);
    }
    expect(current).toBe("system");
    expect(new Set(seen)).toEqual(new Set(THEME_PREFERENCES));
  });

  it("falls back to system for an unknown current value", () => {
    expect(nextPreference("bogus" as ThemePreference)).toBe("system");
  });
});

describe("resolvePreference", () => {
  it("follows the OS signal when system", () => {
    expect(resolvePreference("system", true)).toBe("dark");
    expect(resolvePreference("system", false)).toBe("light");
  });

  it("pins the chosen mode regardless of the OS signal", () => {
    expect(resolvePreference("light", true)).toBe("light");
    expect(resolvePreference("dark", false)).toBe("dark");
  });
});

describe("THEME_INIT_SCRIPT", () => {
  it("threads the shared keys/attributes into the inline snippet", () => {
    expect(THEME_INIT_SCRIPT).toContain(JSON.stringify(THEME_STORAGE_KEY));
    expect(THEME_INIT_SCRIPT).toContain(JSON.stringify(THEME_ATTR));
    expect(THEME_INIT_SCRIPT).toContain(JSON.stringify(THEME_PREF_ATTR));
    expect(THEME_INIT_SCRIPT).toContain(JSON.stringify(THEME_TOGGLE_ATTR));
  });

  it("is a self-contained IIFE with no imports", () => {
    expect(THEME_INIT_SCRIPT.startsWith("(function ()")).toBe(true);
    expect(THEME_INIT_SCRIPT).not.toContain("import");
    expect(THEME_INIT_SCRIPT).toContain("prefers-color-scheme: dark");
  });
});

describe("ThemeToggle", () => {
  it("renders a button carrying all three glyphs and the toggle hook", () => {
    const html = renderToStaticMarkup(<ThemeToggle />);
    expect(html).toContain('type="button"');
    expect(html).toContain('class="theme-toggle"');
    expect(html).toContain(THEME_TOGGLE_ATTR);
    expect(html).toContain("ti-system");
    expect(html).toContain("ti-light");
    expect(html).toContain("ti-dark");
    expect(html).toContain('aria-label="Theme: System (activate to change)"');
  });
});

describe("Layout theming integration", () => {
  it("inlines the pre-paint script and mounts the toggle in the header", () => {
    const html = renderToStaticMarkup(
      <Layout title="T">
        <p>body</p>
      </Layout>,
    );
    // The init script ships in <head> on every page (even no-client ones).
    expect(html).toContain("srr-theme");
    expect(html).toContain("prefers-color-scheme: dark");
    // Light/dark browser chrome hints.
    expect(html).toContain('name="theme-color"');
    expect(html).toContain('content="#0d1117"');
    // The toggle is present in the chrome.
    expect(html).toContain('class="theme-toggle"');
  });
});
