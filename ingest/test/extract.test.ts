import { describe, it, expect } from "vitest";
import { extractText } from "../src/extract.ts";
import { contentHash } from "../src/hash.ts";

describe("extractText — Federal Register (ADR-0008)", () => {
  it("pulls the document text out of the <pre> wrapper", () => {
    const raw =
      "<html><body><pre>[Rules]\nSection 1 &amp; 2 say &quot;report&quot;.\n</pre></body></html>";
    expect(extractText(raw, "federal-register")).toBe(
      '[Rules]\nSection 1 & 2 say "report".',
    );
  });

  it("passes text through when there is no <pre> wrapper", () => {
    expect(extractText("just plain text", "federal-register")).toBe(
      "just plain text",
    );
  });

  it("strips the inline anchors the GPO format embeds, keeping visible text", () => {
    // The GPO raw-text format sprinkles links into the <pre> body, including
    // Cloudflare email obfuscation whose data-cfemail token rotates per fetch —
    // the noise that manufactures phantom diffs. Visible prose must survive; the
    // tags (and that rotating attribute) must not.
    const raw =
      '<html><body><pre>Contact <a href="http://www.gpo.gov">www.gpo.gov</a> or ' +
      '<a href="/cdn-cgi/l/email-protection" data-cfemail="9af2b1">[email&#160;protected]</a> ' +
      "today.</pre></body></html>";
    expect(extractText(raw, "federal-register")).toBe(
      "Contact www.gpo.gov or [email protected] today.",
    );
  });

  it("produces identical text when only the rotating cfemail token differs", () => {
    const doc = (token: string): string =>
      `<html><body><pre>Email <a href="/cdn-cgi/l/email-protection" data-cfemail="${token}">[email protected]</a>.</pre></body></html>`;
    expect(extractText(doc("aaaa11"), "federal-register")).toBe(
      extractText(doc("bbbb22"), "federal-register"),
    );
  });
});

it("passes unknown authorities through unchanged", () => {
  const raw = "<pre>keep this verbatim</pre>";
  expect(extractText(raw, "raw")).toBe(raw);
});

/**
 * An HTML page modeling the volatile chrome a real bill-text / EUR-Lex response
 * carries: a rotating CSRF/JSF ViewState token, a CSP nonce, analytics, and
 * "session"/"generated" stamps — none of which is document text. The statutory
 * body is identical between calls; only `token` differs.
 */
function page(token: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <title>Bill Text</title>
  <meta name="csrf" content="${token}">
  <script nonce="${token}">window.__n="${token}";analytics("${token}");</script>
  <style>.banner{color:#${token.slice(0, 3)}}</style>
</head>
<body>
  <nav class="site">Home | Bills | <span>session ${token}</span></nav>
  <header>Legislature <time datetime="${token}">today</time></header>
  <form id="f" action="/x">
    <input type="hidden" name="javax.faces.ViewState" value="${token}">
    <div id="bill">
      <h2>SB 261</h2>
      <p>Section&nbsp;38533. Covered entities shall prepare a climate-related financial risk report &amp; disclose it.</p>
      <p>Insurance companies are &lt;exempt&gt;.</p>
    </div>
  </form>
  <footer>Generated ${token} &copy; State</footer>
  <script src="/a.js?v=${token}"></script>
</body>
</html>`;
}

describe.each(["ca-leginfo", "eur-lex"])(
  "extractText — %s HTML normalization (ADR-0007, ADR-0008)",
  (authority) => {
    it("produces identical text and hash when only volatile chrome differs", () => {
      const a = extractText(page("AAAA1111"), authority);
      const b = extractText(page("BBBB2222"), authority);
      // The whole point: an unchanged document does not trip the change gate.
      expect(a).toBe(b);
      expect(contentHash(a)).toBe(contentHash(b));
    });

    it("keeps the statutory text and drops the chrome and tokens", () => {
      const out = extractText(page("AAAA1111"), authority);
      expect(out).toContain("SB 261");
      expect(out).toContain(
        "Section 38533. Covered entities shall prepare a climate-related financial risk report & disclose it.",
      );
      expect(out).toContain("Insurance companies are <exempt>.");
      // No rotating token, and no script/nav/footer chrome leaked through.
      expect(out).not.toContain("AAAA1111");
      expect(out).not.toContain("analytics");
      expect(out).not.toContain("session");
      expect(out).not.toContain("Generated");
    });

    it("is stable across whitespace and indentation churn", () => {
      const tidy = "<div><p>Article 1</p><p>Article 2</p></div>";
      const messy = "<div>\n  <p>Article 1</p>\n\n      <p>Article 2</p>\n</div>";
      expect(extractText(messy, authority)).toBe(extractText(tidy, authority));
    });
  },
);

describe("extractText — HTML text shaping", () => {
  it("separates block elements and line breaks so text does not merge", () => {
    const html = "<div><p>Line A<br>Line B</p><p>Line C</p></div>";
    expect(extractText(html, "eur-lex")).toBe("Line A\nLine B\nLine C");
  });

  it("decodes named, numeric, and hex entities", () => {
    const html = "<p>&#xA7;&#32;38533 &amp; &#8482; &lt;ok&gt; &nbsp;end</p>";
    expect(extractText(html, "eur-lex")).toBe("§ 38533 & ™ <ok> end");
  });

  it("replaces an out-of-range numeric reference rather than throwing", () => {
    expect(extractText("<p>&#9999999999;</p>", "eur-lex")).toBe("�");
  });
});
