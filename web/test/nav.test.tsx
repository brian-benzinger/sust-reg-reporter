import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  NAV_BREAKPOINT_PX,
  NAV_ID,
  NAV_INIT_SCRIPT,
  NAV_OPEN_ATTR,
  NAV_TOGGLE_ATTR,
} from "../src/nav.ts";
import { NavToggle } from "../src/components/NavToggle.tsx";
import { Layout } from "../src/components/Layout.tsx";

describe("NAV_INIT_SCRIPT", () => {
  it("threads the shared id/attributes into the inline snippet", () => {
    expect(NAV_INIT_SCRIPT).toContain(JSON.stringify(NAV_ID));
    expect(NAV_INIT_SCRIPT).toContain(JSON.stringify(NAV_TOGGLE_ATTR));
    expect(NAV_INIT_SCRIPT).toContain(JSON.stringify(NAV_OPEN_ATTR));
    // The script watches the viewport one pixel past the CSS breakpoint.
    expect(NAV_INIT_SCRIPT).toContain(JSON.stringify(NAV_BREAKPOINT_PX + 1));
  });

  it("is a self-contained IIFE with no imports", () => {
    expect(NAV_INIT_SCRIPT.startsWith("(function ()")).toBe(true);
    expect(NAV_INIT_SCRIPT).not.toContain("import");
    // Closes on Escape and toggles aria-expanded for assistive tech.
    expect(NAV_INIT_SCRIPT).toContain("Escape");
    expect(NAV_INIT_SCRIPT).toContain("aria-expanded");
  });
});

describe("NavToggle", () => {
  it("renders a labelled button wired to the nav and the toggle hook", () => {
    const html = renderToStaticMarkup(<NavToggle />);
    expect(html).toContain('type="button"');
    expect(html).toContain('class="nav-toggle"');
    expect(html).toContain(NAV_TOGGLE_ATTR);
    expect(html).toContain('aria-label="Menu"');
    expect(html).toContain(`aria-controls="${NAV_ID}"`);
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('class="menu-icon"');
  });
});

describe("Layout navigation integration", () => {
  it("inlines the hamburger script and renders the collapsible nav", () => {
    const html = renderToStaticMarkup(
      <Layout title="T">
        <p>body</p>
      </Layout>,
    );
    // The init script ships in <head> on every page (even no-client ones).
    expect(html).toContain(NAV_OPEN_ATTR);
    // The nav carries the id the hamburger controls, and the hamburger itself.
    expect(html).toContain(`id="${NAV_ID}"`);
    expect(html).toContain('class="nav-toggle"');
    // Every primary destination is in the header, including the change-history
    // and sources pages that were previously only linked further down a page.
    expect(html).toContain('href="/index.html"');
    expect(html).toContain('href="/regimes/index.html"');
    expect(html).toContain('href="/scope-checker.html"');
    expect(html).toContain('href="/as-of.html"');
    expect(html).toContain('href="/diffs.html"');
    expect(html).toContain('href="/sources.html"');
  });
});
