import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Obligation } from "@sust-reg/core";
import { obligationView, regimeGroups } from "../src/model.ts";
import { NOT_LEGAL_ADVICE } from "../src/content.ts";
import { Layout } from "../src/components/Layout.tsx";
import { GroundedBadge, StatusBadge } from "../src/components/Badges.tsx";
import { Home } from "../src/components/Home.tsx";
import { RegimesIndex } from "../src/components/RegimesIndex.tsx";
import { ObligationPage } from "../src/components/ObligationPage.tsx";
import { ScopeCheckerPage } from "../src/components/ScopeCheckerPage.tsx";
import { AsOfSliderPage } from "../src/components/AsOfSliderPage.tsx";
import { StatusStatesPage } from "../src/components/StatusStatesPage.tsx";
import { MethodologyPage } from "../src/components/MethodologyPage.tsx";

const full: Obligation = {
  id: "full-ob",
  regime: "DEMO",
  title: "Full obligation",
  status: "enforced",
  criteria: { minTotalAnnualRevenueUSD: 100, operatesInAnyOf: ["US-CA"] },
  firstReportingDeadline: "2027-01-01",
  source: {
    label: "Real § 1",
    snapshotHash: "sha256:real",
    sourceUrl: "https://example.gov/s",
    retrievedAt: "2026-05-01",
  },
};

const bare: Obligation = {
  id: "bare-ob",
  regime: "DEMO",
  title: "Bare obligation",
  status: "stayed",
  criteria: {},
  source: { label: "Seed", snapshotHash: "ungrounded:seed" },
};

describe("Layout", () => {
  it("renders description, canonical, and the hydration script when asked", () => {
    const html = renderToStaticMarkup(
      <Layout title="T" description="D" canonicalPath="/x.html" withClient>
        <p>body-here</p>
      </Layout>,
    );
    expect(html).toContain("<title>T</title>");
    expect(html).toContain('name="description" content="D"');
    expect(html).toContain('rel="canonical" href="/x.html"');
    expect(html).toContain('src="/app.js"');
    expect(html).toContain(NOT_LEGAL_ADVICE);
    expect(html).toContain("<p>body-here</p>");
    // Reference pages are reachable from the footer on every page.
    expect(html).toContain('href="/status-states.html"');
    expect(html).toContain('href="/methodology.html"');
  });

  it("omits optional head tags and the script by default", () => {
    const html = renderToStaticMarkup(
      <Layout title="Bare">
        <span />
      </Layout>,
    );
    expect(html).not.toContain('name="description"');
    expect(html).not.toContain('rel="canonical"');
    expect(html).not.toContain("/app.js");
  });
});

describe("badges", () => {
  it("styles status pills and distinguishes grounding", () => {
    expect(
      renderToStaticMarkup(<StatusBadge status="enforced" label="Enforced" />),
    ).toContain("badge status-enforced");
    expect(renderToStaticMarkup(<GroundedBadge grounded />)).toContain(
      "Grounded",
    );
    expect(
      renderToStaticMarkup(<GroundedBadge grounded={false} />),
    ).toContain("Ungrounded");
  });
});

describe("content pages", () => {
  const groups = regimeGroups([full, bare]);

  it("Home reports corpus size and links the scope checker", () => {
    const html = renderToStaticMarkup(<Home groups={groups} />);
    expect(html).toContain("2 obligation(s) across");
    expect(html).toContain('href="/scope-checker.html"');
  });

  it("RegimesIndex lists a section and cards per regime", () => {
    const html = renderToStaticMarkup(<RegimesIndex groups={groups} />);
    expect(html).toContain("<h2>DEMO</h2>");
    expect(html).toContain('href="/regimes/full-ob.html"');
  });

  it("ObligationPage shows optional rows when present", () => {
    const html = renderToStaticMarkup(
      <ObligationPage view={obligationView(full)} />,
    );
    expect(html).toContain("First reporting deadline");
    expect(html).toContain('href="https://example.gov/s"');
    expect(html).toContain("Retrieved");
    expect(html).toContain("Grounded");
  });

  it("ObligationPage omits optional rows when absent", () => {
    const html = renderToStaticMarkup(
      <ObligationPage view={obligationView(bare)} />,
    );
    expect(html).not.toContain("First reporting deadline");
    expect(html).not.toContain("<dt>Source</dt>");
    expect(html).not.toContain("Retrieved");
    expect(html).toContain("Ungrounded");
    expect(html).toContain("Applies to all entities in scope");
  });
});

describe("ScopeCheckerPage (static prerender)", () => {
  it("renders the heading, mount node, and a worked default result", () => {
    const html = renderToStaticMarkup(<ScopeCheckerPage />);
    expect(html).toContain("Scope checker");
    expect(html).toContain('id="scope-checker-root"');
    // Default corpus: SB 261 applies at the default $750M profile.
    expect(html).toContain("obligation(s) apply");
    expect(html).toContain("Climate-related financial risk report");
  });
});

describe("AsOfSliderPage (static prerender)", () => {
  it("renders the heading, mount node, and the default-history table", () => {
    const html = renderToStaticMarkup(<AsOfSliderPage />);
    expect(html).toContain("As-of-date slider");
    expect(html).toContain('id="as-of-slider-root"');
    // Default seed histories include the two California obligations.
    expect(html).toContain("Climate-related financial risk report");
    expect(html).toContain('type="range"');
  });
});

describe("StatusStatesPage", () => {
  it("documents every status with the law/enforcement matrix", () => {
    const html = renderToStaticMarkup(<StatusStatesPage />);
    expect(html).toContain("Regulation status states");
    // All four explicit states are present (ADR-0006).
    for (const label of ["Proposed", "In effect", "Enforced", "Stayed"]) {
      expect(html).toContain(label);
    }
    // The matrix covers both Yes and No on each axis (proposed is not law;
    // only enforced is currently enforced).
    expect(html).toContain("<td>Yes</td>");
    expect(html).toContain("<td>No</td>");
    expect(html).toContain("SB 261");
  });
});

describe("MethodologyPage", () => {
  it("explains grounding, history, and the non-interpretive scope", () => {
    const html = renderToStaticMarkup(<MethodologyPage />);
    expect(html).toContain("Methodology");
    expect(html).toContain("Citation integrity");
    expect(html).toContain("ungrounded seed data");
    expect(html).toContain('href="/as-of.html"');
    expect(html).toContain('href="/status-states.html"');
  });
});
