/**
 * Normalize a fetched source body to its meaningful text (ADR-0008).
 *
 * The hash and diff run over this output, so it must be STABLE: two fetches of
 * an unchanged document must produce identical text even when the surrounding
 * page chrome differs between responses. That stability is what makes the
 * content-hash change gate (ADR-0007) and its cost discipline (ADR-0016) real —
 * a snapshot and a (paid) `semdiff` run should happen only when the *document*
 * changed, never because a CSRF token, JSF ViewState, CSP nonce, analytics
 * blob, or session id rotated.
 *
 * Per authority:
 *  - `federal-register`: the raw-text endpoint wraps the document in a minimal
 *    `<html><body><pre>…</pre>` shell, so we take the `<pre>` content.
 *  - `ca-leginfo` (California bill text) and `eur-lex` (EU legislation): full
 *    HTML pages, reduced to text by dropping every tag — and therefore every
 *    attribute, where the rotating tokens above live — along with the
 *    non-content elements (`script`/`style`/`head`/`nav`/`header`/`footer`/…)
 *    and collapsing whitespace.
 *  - anything else passes through unchanged (e.g. the inline demo source).
 *
 * NOTE: this neutralizes the dominant volatile sources (attributes, scripts,
 * styles, and standard chrome). If a live sample shows volatile *visible* text
 * outside those elements (e.g. a "generated at" stamp in a content `<div>`),
 * the fix is a small authority-specific content-region narrowing — validate
 * against the first real snapshot before relying on it.
 */
export function extractText(raw: string, authority: string): string {
  switch (authority) {
    case "federal-register":
      return fromFederalRegister(raw);
    case "ca-leginfo":
    case "eur-lex":
      return htmlToText(raw);
    default:
      return raw;
  }
}

function fromFederalRegister(raw: string): string {
  const match = /<pre>([\s\S]*?)<\/pre>/i.exec(raw);
  const inner = match?.[1];
  return inner !== undefined ? decodeEntities(inner).trim() : raw;
}

/** Elements whose content is never document text (and is often volatile). */
const DROP_ELEMENTS = [
  "script",
  "style",
  "head",
  "noscript",
  "template",
  "nav",
  "header",
  "footer",
  "aside",
];

/** Block-level closers turned into newlines so adjacent text does not merge. */
const BLOCK_CLOSE = /<\/(p|div|section|article|li|tr|h[1-6]|blockquote|td|th)>/gi;

/**
 * Reduce an HTML page to stable, meaningful text (see the module note). Pure and
 * regex-based — no DOM dependency — which is sufficient because we are deleting
 * structure, not interpreting it.
 */
function htmlToText(html: string): string {
  let s = html.replace(/<!--[\s\S]*?-->/g, " ");
  for (const tag of DROP_ELEMENTS) {
    s = s.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?</${tag}>`, "gi"), " ");
  }
  s = s.replace(BLOCK_CLOSE, "\n").replace(/<br\s*\/?>/gi, "\n");
  s = s.replace(/<[^>]+>/g, " ");
  return collapse(decodeEntities(s));
}

/** Collapse intra-line whitespace, trim, and drop blank lines — order-stable. */
function collapse(s: string): string {
  return s
    .split("\n")
    .map((line) => line.replace(/[^\S\n]+/g, " ").trim())
    .filter((line) => line.length > 0)
    .join("\n");
}

function decodeEntities(s: string): string {
  return (
    s
      .replace(/&nbsp;/gi, " ")
      .replace(/&#(\d+);/g, (_, d: string) => codePoint(Number(d)))
      .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => codePoint(parseInt(h, 16)))
      .replaceAll("&lt;", "<")
      .replaceAll("&gt;", ">")
      .replaceAll("&quot;", '"')
      // `&amp;` LAST so we never double-decode (e.g. `&amp;lt;` → `&lt;`).
      .replaceAll("&amp;", "&")
  );
}

/** A numeric character reference's text, or a replacement char if out of range. */
function codePoint(n: number): string {
  return n >= 0 && n <= 0x10ffff ? String.fromCodePoint(n) : "�";
}
