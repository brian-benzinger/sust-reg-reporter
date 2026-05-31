import { describe, it, expect } from "vitest";
import { extractText } from "../src/extract.ts";

describe("extractText (ADR-0008)", () => {
  it("pulls the document text out of the Federal Register <pre> wrapper", () => {
    const raw =
      "<html><body><pre>[Rules]\nSection 1 &amp; 2 say &quot;report&quot;.\n</pre></body></html>";
    expect(extractText(raw, "federal-register")).toBe(
      '[Rules]\nSection 1 & 2 say "report".',
    );
  });

  it("passes Federal Register text through when there is no <pre> wrapper", () => {
    expect(extractText("just plain text", "federal-register")).toBe(
      "just plain text",
    );
  });

  it("passes other authorities through unchanged", () => {
    const raw = "<pre>keep this verbatim</pre>";
    expect(extractText(raw, "eur-lex")).toBe(raw);
  });
});
