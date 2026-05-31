import { describe, it, expect } from "vitest";
import { obligationView } from "../src/model.ts";
import type { Obligation } from "@sust-reg/core";
import {
  NOT_LEGAL_ADVICE,
  escapeHtml,
  groundedBadge,
  layout,
  renderHomePage,
  renderObligationPage,
  renderRegimesIndex,
  statusBadge,
} from "../src/render.ts";
import { regimeGroups } from "../src/model.ts";

describe("escapeHtml", () => {
  it("escapes all five HTML-sensitive characters", () => {
    expect(escapeHtml(`<a href="x" title='y'>Tom & Jerry</a>`)).toBe(
      "&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;Tom &amp; Jerry&lt;/a&gt;",
    );
  });

  it("leaves safe text untouched", () => {
    expect(escapeHtml("US-CA revenue")).toBe("US-CA revenue");
  });
});

describe("layout", () => {
  it("includes description and canonical when supplied", () => {
    const html = layout({
      title: "T",
      description: "D",
      canonicalPath: "/x.html",
      body: "<p>hi</p>",
    });
    expect(html).toContain("<title>T</title>");
    expect(html).toContain('name="description" content="D"');
    expect(html).toContain('rel="canonical" href="/x.html"');
    expect(html).toContain(NOT_LEGAL_ADVICE);
    expect(html).toContain("<p>hi</p>");
  });

  it("omits description and canonical when not supplied", () => {
    const html = layout({ title: "Bare", body: "" });
    expect(html).not.toContain('name="description"');
    expect(html).not.toContain('rel="canonical"');
  });
});

const grounded: Obligation = {
  id: "g",
  regime: "DEMO",
  title: "Grounded <obligation>",
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

const ungrounded: Obligation = {
  id: "u",
  regime: "DEMO",
  title: "Ungrounded obligation",
  status: "stayed",
  criteria: {},
  source: { label: "Seed", snapshotHash: "ungrounded:seed" },
};

describe("badges", () => {
  it("styles the status pill by lifecycle state", () => {
    expect(statusBadge(obligationView(grounded))).toContain(
      'class="badge status-enforced"',
    );
    expect(statusBadge(obligationView(ungrounded))).toContain(
      'class="badge status-stayed"',
    );
  });

  it("distinguishes grounded from ungrounded citations", () => {
    expect(groundedBadge(obligationView(grounded).citation)).toContain(
      "grounded",
    );
    expect(groundedBadge(obligationView(ungrounded).citation)).toContain(
      "Ungrounded",
    );
  });
});

describe("renderHomePage", () => {
  it("reports corpus size and lists the three interactive features", () => {
    const html = renderHomePage(regimeGroups([grounded, ungrounded]));
    expect(html).toContain("models 2 obligation(s) across");
    expect(html).toContain("1 regime(s)");
    expect(html).toContain("As-of-date slider");
    expect(html).toContain("Scope checker");
    expect(html).toContain("Diff view");
  });
});

describe("renderRegimesIndex", () => {
  it("renders a section per regime with linked obligation cards", () => {
    const html = renderRegimesIndex(regimeGroups([grounded, ungrounded]));
    expect(html).toContain("<h2>DEMO</h2>");
    expect(html).toContain('href="/regimes/g.html"');
    expect(html).toContain('href="/regimes/u.html"');
    // Title is escaped, not injected raw.
    expect(html).toContain("Grounded &lt;obligation&gt;");
    expect(html).not.toContain("Grounded <obligation>");
  });
});

describe("renderObligationPage", () => {
  it("shows deadline, source link, and retrieval date when present", () => {
    const html = renderObligationPage(obligationView(grounded));
    expect(html).toContain("First reporting deadline");
    expect(html).toContain("2027-01-01");
    expect(html).toContain('href="https://example.gov/s"');
    expect(html).toContain("Retrieved");
    expect(html).toContain("2026-05-01");
    expect(html).toContain("Enforced");
  });

  it("omits absent deadline, source link, and retrieval date", () => {
    const html = renderObligationPage(obligationView(ungrounded));
    expect(html).not.toContain("First reporting deadline");
    expect(html).not.toContain("<dt>Source</dt>");
    expect(html).not.toContain("Retrieved");
    expect(html).toContain("Ungrounded");
    // Empty-criteria fallback sentence is shown.
    expect(html).toContain("Applies to all entities in scope");
  });
});
