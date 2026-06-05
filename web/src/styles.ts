/**
 * The site stylesheet.
 *
 * Kept as a plain string constant that the prerender step writes to
 * dist/styles.css, rather than imported through a CSS loader — it ships as one
 * cacheable file behind CloudFront (ADR-0014), needs no extra webpack loaders,
 * and is identical for the prerendered HTML and the hydrated client. System
 * fonts, no external requests, and a legible high-contrast palette — the site
 * must be usable by non-developers and indexable (ADR-0013).
 *
 * The visual language is a small, modern design system expressed entirely in
 * design tokens (ADR-0030): a layered surface scale, an emerald→cyan brand
 * gradient, soft elevation, and a fluid type scale. Every color flows through a
 * CSS variable so dark mode stays a token override (ADR-0029) and so the whole
 * system can be retuned from one place. No external framework or font is pulled
 * in — the tokens *are* the framework, which keeps the single-file, no-external-
 * request hosting contract intact (ADR-0014, ADR-0016).
 */

/** Root-relative URL of the generated stylesheet. */
export const STYLESHEET_PATH = "/styles.css";

export const STYLESHEET = `:root {
  /* Structural tokens — theme-independent. */
  --maxw: 64rem;
  --radius-sm: 8px;
  --radius: 12px;
  --radius-lg: 20px;
  --radius-pill: 999px;
  --ease: cubic-bezier(0.22, 1, 0.36, 1);

  /* Fluid type scale. */
  --fs-hero: clamp(2.1rem, 1.4rem + 3.2vw, 3.4rem);
  --fs-h1: clamp(1.8rem, 1.4rem + 1.8vw, 2.5rem);
  --fs-h2: clamp(1.25rem, 1.1rem + 0.7vw, 1.55rem);
  --fs-lead: clamp(1.05rem, 1rem + 0.4vw, 1.25rem);

  /* Light palette. */
  --bg: #f7f9fb;
  --bg-elev: #ffffff;
  --fg: #0f1b22;
  --muted: #5a6b76;
  --border: #e2e8ee;
  --border-strong: #cfd8e0;
  --surface: #eef3f7;
  --surface-2: #e6edf2;

  /* Brand + semantic accents. */
  --accent: #0e9f6e;
  --accent-2: #0891b2;
  --accent-strong: #0a7a52;
  --on-accent: #ffffff;
  --link: #0a7a52;
  --info: #1668c2;
  --ok: #1a7f37;
  --paused: #9a6700;
  --warn-bg: #fff8e6;
  --warn-border: #e3b341;

  /* Soft, layered elevation. */
  --shadow-sm: 0 1px 2px rgba(15, 27, 34, 0.05), 0 1px 3px rgba(15, 27, 34, 0.06);
  --shadow-md: 0 4px 12px rgba(15, 27, 34, 0.08), 0 2px 4px rgba(15, 27, 34, 0.05);
  --shadow-lg: 0 18px 40px rgba(15, 27, 34, 0.13), 0 6px 14px rgba(15, 27, 34, 0.08);

  /* Page-level ambient gradient wash. */
  --wash: radial-gradient(60rem 40rem at 78% -12%, color-mix(in srgb, var(--accent) 13%, transparent), transparent 60%),
          radial-gradient(50rem 36rem at -8% 8%, color-mix(in srgb, var(--accent-2) 11%, transparent), transparent 55%);

  color-scheme: light;
}

/* Dark palette (ADR-0029). The inline init script sets data-theme on <html>
   before paint; every color above flows through a variable, so a mode is just
   a token override. Values track GitHub's dark scale for AA-legible contrast. */
:root[data-theme="dark"] {
  --bg: #0b1118;
  --bg-elev: #131c25;
  --fg: #e7eef4;
  --muted: #93a1ad;
  --border: #25323d;
  --border-strong: #344350;
  --surface: #161f29;
  --surface-2: #1c2731;

  --accent: #34d399;
  --accent-2: #22d3ee;
  --accent-strong: #5ee7b6;
  --on-accent: #04241a;
  --link: #4ce0a6;
  --info: #58a6ff;
  --ok: #3fb950;
  --paused: #d29922;
  --warn-bg: #2d2410;
  --warn-border: #9e6a03;

  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.4);
  --shadow-md: 0 6px 16px rgba(0, 0, 0, 0.45);
  --shadow-lg: 0 22px 48px rgba(0, 0, 0, 0.55), 0 8px 18px rgba(0, 0, 0, 0.4);

  color-scheme: dark;
}

/* No-JS fallback: honor the OS preference when the script never ran and no
   explicit choice is pinned. With JS, data-theme is always set, so this is
   inert. */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme]) {
    --bg: #0b1118;
    --bg-elev: #131c25;
    --fg: #e7eef4;
    --muted: #93a1ad;
    --border: #25323d;
    --border-strong: #344350;
    --surface: #161f29;
    --surface-2: #1c2731;

    --accent: #34d399;
    --accent-2: #22d3ee;
    --accent-strong: #5ee7b6;
    --on-accent: #04241a;
    --link: #4ce0a6;
    --info: #58a6ff;
    --ok: #3fb950;
    --paused: #d29922;
    --warn-bg: #2d2410;
    --warn-border: #9e6a03;

    --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.4);
    --shadow-md: 0 6px 16px rgba(0, 0, 0, 0.45);
    --shadow-lg: 0 22px 48px rgba(0, 0, 0, 0.55), 0 8px 18px rgba(0, 0, 0, 0.4);

    color-scheme: dark;
  }
}

* { box-sizing: border-box; }

html { -webkit-text-size-adjust: 100%; scroll-behavior: smooth; }

body {
  margin: 0;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  line-height: 1.65;
  color: var(--fg);
  background-color: var(--bg);
  background-image: var(--wash);
  background-repeat: no-repeat;
  background-attachment: fixed;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
  /* Sticky footer: a full-height flex column so a short page's footer still
     sits at the bottom of the viewport (main grows to fill the gap), while a
     tall page scrolls and the footer follows the content. */
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  min-height: 100dvh;
}

/* Ease the swap between modes and the interactive micro-motion; respect the
   reduced-motion preference by scoping every transition behind it. */
@media (prefers-reduced-motion: no-preference) {
  body, header.site, footer.site, .card, .feature-card, .stat, .theme-toggle,
  .result, .btn, form.scope input, form.scope select, table.data-table tbody tr {
    transition: background-color 0.2s var(--ease), border-color 0.2s var(--ease),
      color 0.2s var(--ease), box-shadow 0.2s var(--ease), transform 0.2s var(--ease);
  }
}

a { color: var(--link); text-decoration-thickness: 1px; text-underline-offset: 0.15em; }
a:hover { text-decoration: none; }

:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-radius: 4px;
}

.wrap { max-width: var(--maxw); margin: 0 auto; padding: 0 1.25rem; }

/* Skip link for keyboard users — visually hidden until focused. */
.skip-link {
  position: absolute;
  left: -999px;
  top: 0.5rem;
  z-index: 100;
  background: var(--accent);
  color: var(--on-accent);
  padding: 0.5rem 0.9rem;
  border-radius: var(--radius-sm);
  font-weight: 600;
}
.skip-link:focus { left: 0.75rem; }

/* ---- Header ---------------------------------------------------------- */
header.site {
  position: sticky;
  top: 0;
  z-index: 50;
  border-bottom: 1px solid var(--border);
  background: color-mix(in srgb, var(--bg-elev) 78%, transparent);
  -webkit-backdrop-filter: saturate(1.6) blur(12px);
  backdrop-filter: saturate(1.6) blur(12px);
}
header.site .wrap {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 1.5rem;
  padding-top: 0.85rem;
  padding-bottom: 0.85rem;
}
header.site .brand {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 700;
  font-size: 1.1rem;
  letter-spacing: -0.01em;
  color: var(--fg);
  text-decoration: none;
}
header.site .brand .leaf-icon {
  color: var(--on-accent);
  flex: none;
  width: 1.9rem;
  height: 1.9rem;
  padding: 0.32rem;
  border-radius: 9px;
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  box-shadow: var(--shadow-sm);
}
header.site nav { display: flex; flex-wrap: wrap; gap: 0.25rem; margin-left: auto; }
header.site nav a {
  color: var(--muted);
  text-decoration: none;
  font-weight: 500;
  font-size: 0.95rem;
  padding: 0.35rem 0.7rem;
  border-radius: var(--radius-pill);
}
header.site nav a:hover {
  color: var(--fg);
  background: var(--surface);
}

/* Theme toggle (ADR-0029). Carries all three glyphs; CSS reveals the one that
   matches the live preference attribute the inline script sets on <html>. */
.theme-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  align-self: center;
  width: 2.2rem;
  height: 2.2rem;
  padding: 0;
  color: var(--fg);
  background: var(--bg-elev);
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  cursor: pointer;
  line-height: 0;
  box-shadow: var(--shadow-sm);
}
.theme-toggle:hover { border-color: var(--accent); color: var(--accent); transform: translateY(-1px); }
.theme-toggle:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.theme-toggle .ti { display: none; }
/* Default to the System glyph before the script sets the preference attribute,
   so no-JS visitors still see a sensible icon. */
:root:not([data-theme-pref]) .theme-toggle .ti-system,
:root[data-theme-pref="system"] .theme-toggle .ti-system,
:root[data-theme-pref="light"] .theme-toggle .ti-light,
:root[data-theme-pref="dark"] .theme-toggle .ti-dark { display: inline-flex; }

/* ---- Main + typography ---------------------------------------------- */
/* Grow to fill the viewport so the footer is pushed to the bottom on short
   pages; never shrink below the content's height on tall ones. */
main { padding: 2.5rem 0 4rem; flex: 1 0 auto; }

h1 { font-size: var(--fs-h1); line-height: 1.15; letter-spacing: -0.02em; margin: 0 0 0.75rem; }
h2 { font-size: var(--fs-h2); line-height: 1.25; letter-spacing: -0.01em; margin: 2.25rem 0 0.6rem; }
h3 { font-size: 1.05rem; margin: 1.25rem 0 0.25rem; }

p.lead { font-size: var(--fs-lead); color: var(--muted); margin-top: 0; max-width: 46rem; }

/* ---- Hero (home) ----------------------------------------------------- */
.hero { padding: 1rem 0 0.5rem; }
.hero .eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--accent-strong);
  background: color-mix(in srgb, var(--accent) 12%, var(--bg-elev));
  border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
  padding: 0.3rem 0.7rem;
  border-radius: var(--radius-pill);
  margin-bottom: 1.1rem;
}
.hero .eyebrow .dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 25%, transparent);
}
.hero h1 {
  font-size: var(--fs-hero);
  line-height: 1.08;
  max-width: 18ch;
}
.hero .grad {
  background: linear-gradient(120deg, var(--accent), var(--accent-2) 70%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.hero p.lead { margin-top: 1rem; }

/* ---- Notice / disclaimer -------------------------------------------- */
.notice {
  display: flex;
  gap: 0.65rem;
  align-items: flex-start;
  border: 1px solid var(--warn-border);
  background: var(--warn-bg);
  border-radius: var(--radius);
  padding: 0.8rem 1rem;
  margin: 1.5rem 0;
  font-size: 0.95rem;
  box-shadow: var(--shadow-sm);
}
.notice::before {
  content: "";
  flex: none;
  width: 1.15rem;
  height: 1.15rem;
  margin-top: 0.15rem;
  background: var(--paused);
  -webkit-mask: var(--icon-info) center / contain no-repeat;
  mask: var(--icon-info) center / contain no-repeat;
}

/* ---- Buttons / link affordances ------------------------------------- */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font: inherit;
  font-weight: 600;
  text-decoration: none;
  padding: 0.6rem 1.1rem;
  border-radius: var(--radius-pill);
  border: 1px solid transparent;
  cursor: pointer;
}
.btn-primary {
  color: var(--on-accent);
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  box-shadow: var(--shadow-md);
}
.btn-primary:hover { transform: translateY(-1px); box-shadow: var(--shadow-lg); }
.btn-ghost {
  color: var(--fg);
  background: var(--bg-elev);
  border-color: var(--border-strong);
}
.btn-ghost:hover { border-color: var(--accent); color: var(--accent-strong); }
.cta-row { display: flex; flex-wrap: wrap; gap: 0.75rem; margin: 1.5rem 0 0.5rem; }

/* ---- Stats ----------------------------------------------------------- */
.stat-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
  gap: 0.9rem;
  margin: 2rem 0;
}
.stat {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg-elev);
  padding: 1rem 1.1rem;
  box-shadow: var(--shadow-sm);
}
.stat .num {
  font-size: 1.9rem;
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.02em;
  background: linear-gradient(120deg, var(--accent), var(--accent-2));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.stat .label { display: block; color: var(--muted); font-size: 0.85rem; margin-top: 0.4rem; }

/* ---- Cards ----------------------------------------------------------- */
.card {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 1.1rem 1.3rem;
  margin: 0.85rem 0;
  background: var(--bg-elev);
  box-shadow: var(--shadow-sm);
}
.card:hover { box-shadow: var(--shadow-md); border-color: var(--border-strong); }
.card h3 { margin-top: 0; }
.card .meta { color: var(--muted); font-size: 0.9rem; display: flex; flex-wrap: wrap; align-items: center; gap: 0.4rem; }

.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(17rem, 1fr));
  gap: 0.9rem;
  margin: 0.85rem 0;
}
.card-grid .card { margin: 0; height: 100%; }

/* ---- Feature grid (home) -------------------------------------------- */
.feature-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(15.5rem, 1fr));
  gap: 1rem;
  margin: 1.25rem 0;
}
.feature-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  text-decoration: none;
  color: var(--fg);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg-elev);
  padding: 1.25rem 1.3rem 1.4rem;
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}
.feature-card::after {
  content: "";
  position: absolute;
  inset: 0 0 auto 0;
  height: 3px;
  background: linear-gradient(90deg, var(--accent), var(--accent-2));
  transform: scaleX(0);
  transform-origin: left;
  transition: transform 0.25s var(--ease);
}
.feature-card:hover { transform: translateY(-3px); box-shadow: var(--shadow-lg); border-color: var(--border-strong); }
.feature-card:hover::after { transform: scaleX(1); }
.feature-card .ficon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.6rem;
  height: 2.6rem;
  border-radius: 11px;
  color: var(--accent-strong);
  background: color-mix(in srgb, var(--accent) 14%, var(--bg-elev));
  border: 1px solid color-mix(in srgb, var(--accent) 28%, transparent);
}
.feature-card .ficon svg { width: 1.4rem; height: 1.4rem; }
.feature-card .ftitle { font-weight: 700; font-size: 1.05rem; display: flex; align-items: center; gap: 0.35rem; }
.feature-card .ftitle .arrow { color: var(--muted); transition: transform 0.2s var(--ease); }
.feature-card:hover .ftitle .arrow { transform: translateX(3px); color: var(--accent-strong); }
.feature-card p { margin: 0; color: var(--muted); font-size: 0.92rem; }

/* Legacy feature list (kept for any non-grid consumers). */
.feature-list { list-style: none; padding: 0; }
.feature-list li { margin: 0.75rem 0; }
.feature-list .soon { color: var(--muted); font-size: 0.85rem; }

/* ---- Badges ---------------------------------------------------------- */
.badge {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.74rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  padding: 0.18rem 0.55rem;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--fg);
}
.badge::before {
  content: "";
  width: 0.45rem;
  height: 0.45rem;
  border-radius: 50%;
  background: currentColor;
}
.badge.status-enforced { border-color: color-mix(in srgb, var(--ok) 40%, transparent); color: var(--ok); background: color-mix(in srgb, var(--ok) 12%, var(--bg-elev)); }
.badge.status-in-effect { border-color: color-mix(in srgb, var(--info) 40%, transparent); color: var(--info); background: color-mix(in srgb, var(--info) 12%, var(--bg-elev)); }
.badge.status-stayed { border-color: color-mix(in srgb, var(--paused) 45%, transparent); color: var(--paused); background: color-mix(in srgb, var(--paused) 13%, var(--bg-elev)); }
.badge.status-proposed { border-color: var(--border-strong); color: var(--muted); background: var(--surface); }
.badge.grounded { border-color: color-mix(in srgb, var(--ok) 40%, transparent); color: var(--ok); background: color-mix(in srgb, var(--ok) 12%, var(--bg-elev)); }
.badge.ungrounded { border-color: color-mix(in srgb, var(--warn-border) 55%, transparent); color: var(--paused); background: var(--warn-bg); }

/* Grounding cell: the pill plus a small confidence chip (ADR-0028, ADR-0017). */
.grounding-cell { display: inline-flex; align-items: center; gap: 0.4rem; }
.confidence {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--muted);
}
.confidence-high { color: var(--ok); }
.confidence-medium { color: var(--info); }
.confidence-low { color: var(--paused); }

/* ---- Lists / definition lists --------------------------------------- */
ul.facts { margin: 0.5rem 0; padding-left: 1.25rem; }
ul.facts li { margin: 0.25rem 0; }

dl.kv {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 0.5rem 1.25rem;
  margin: 1rem 0;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg-elev);
  padding: 1rem 1.2rem;
  box-shadow: var(--shadow-sm);
}
dl.kv dt { color: var(--muted); font-weight: 600; }
dl.kv dd { margin: 0; }

/* ---- Footer ---------------------------------------------------------- */
footer.site {
  flex-shrink: 0;
  border-top: 1px solid var(--border);
  background: var(--bg-elev);
  color: var(--muted);
  font-size: 0.88rem;
  padding: 2rem 0 3rem;
}
footer.site p { margin: 0.4rem 0; }
footer.site .footer-nav { display: flex; flex-wrap: wrap; gap: 1.25rem; margin-bottom: 0.75rem; }
footer.site .footer-nav a { color: var(--fg); text-decoration: none; font-weight: 500; }
footer.site .footer-nav a:hover { color: var(--accent-strong); }

/* Copyright line and the author's source/social icon links. */
.footer-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem 1rem;
  margin-top: 1.25rem;
  padding-top: 1.1rem;
  border-top: 1px solid var(--border);
}
.footer-meta .copyright { margin: 0; }
.footer-social { display: inline-flex; align-items: center; gap: 0.4rem; }
.footer-social a {
  display: inline-flex;
  color: var(--muted);
  padding: 0.35rem;
  border-radius: var(--radius-sm);
}
.footer-social a:hover { color: var(--accent-strong); background: var(--surface); }
.footer-social .social-icon { display: block; }

/* ---- Panels for the interactive islands ----------------------------- */
.panel {
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--bg-elev);
  padding: 1.3rem 1.4rem;
  margin: 1.5rem 0;
  box-shadow: var(--shadow-md);
}

/* ---- Scope checker form --------------------------------------------- */
form.scope { margin: 0; }
form.scope .fields {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
  gap: 1rem 1.25rem;
}
form.scope label { display: block; font-weight: 600; font-size: 0.95rem; }
form.scope .hint { display: block; font-weight: 400; color: var(--muted); font-size: 0.82rem; }
form.scope input,
form.scope select {
  width: 100%;
  margin-top: 0.4rem;
  padding: 0.55rem 0.7rem;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  font: inherit;
  background: var(--bg);
  color: var(--fg);
}
form.scope input:focus,
form.scope select:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 25%, transparent);
}

.errors {
  border: 1px solid var(--warn-border);
  background: var(--warn-bg);
  border-radius: var(--radius);
  padding: 0.6rem 1rem;
  margin: 1rem 0;
  color: var(--paused);
}
.errors ul { margin: 0.25rem 0; padding-left: 1.25rem; }

.summary {
  color: var(--fg);
  font-weight: 500;
  margin: 1.25rem 0 1rem;
  padding: 0.6rem 0.9rem;
  border-left: 3px solid var(--accent);
  background: color-mix(in srgb, var(--accent) 7%, var(--bg-elev));
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
}

/* ---- Result cards (scope checker) ----------------------------------- */
.result {
  border: 1px solid var(--border);
  border-left-width: 4px;
  border-radius: var(--radius);
  padding: 0.95rem 1.2rem;
  margin: 0.7rem 0;
  background: var(--bg-elev);
  box-shadow: var(--shadow-sm);
}
.result.applies { border-left-color: var(--info); }
.result.applies.enforceable { border-left-color: var(--ok); }
.result.excluded { border-left-color: var(--border-strong); opacity: 0.78; }
.result:hover { box-shadow: var(--shadow-md); }
.result h3 { margin: 0 0 0.25rem; }
.result .verdict {
  font-weight: 700;
  font-size: 0.82rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
.result .verdict.yes { color: var(--info); }
.result .verdict.no { color: var(--muted); }
.result.enforceable .verdict.yes { color: var(--ok); }
.result ul.reasons { margin: 0.4rem 0 0; padding-left: 1.25rem; font-size: 0.92rem; color: var(--muted); }
.result .due { font-size: 0.9rem; color: var(--muted); margin-bottom: 0; }

/* ---- As-of slider controls ------------------------------------------ */
.asof-controls {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
  gap: 1.25rem 1.75rem;
  margin: 0.5rem 0 1.5rem;
}
.asof-controls label { display: block; font-weight: 600; }
.asof-controls label strong { color: var(--accent-strong); font-variant-numeric: tabular-nums; }
.asof-controls input[type="range"] {
  width: 100%;
  margin-top: 0.6rem;
  accent-color: var(--accent);
}

/* ---- Data tables ----------------------------------------------------- */
table.asof-table, table.sources-table, table.diffs-table {
  border-collapse: separate;
  border-spacing: 0;
  width: 100%;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
  background: var(--bg-elev);
  box-shadow: var(--shadow-sm);
}
table.asof-table th, table.sources-table th, table.diffs-table th,
table.asof-table td, table.sources-table td, table.diffs-table td {
  text-align: left;
  padding: 0.7rem 1rem;
  border-bottom: 1px solid var(--border);
}
table.asof-table th, table.sources-table th, table.diffs-table th {
  color: var(--muted);
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  background: var(--surface);
}
table.asof-table tbody tr:last-child td,
table.sources-table tbody tr:last-child td,
table.diffs-table tbody tr:last-child td { border-bottom: none; }
table.asof-table tbody tr:hover,
table.sources-table tbody tr:hover,
table.diffs-table tbody tr:hover { background: var(--surface); }

/* Stable geometry so the table never resizes when a slider move swaps a pill
   badge for plain text — a status "—", or grounded/ungrounded — on refresh.
   Each body cell reserves a fixed row height and centers its content, so a
   badge and a dash occupy the same space (no vertical jump). Reserved minimum
   widths on the Status and Grounding columns keep the layout from reflowing
   horizontally as badge widths change. */
table.asof-table td {
  height: 3rem;
  padding-top: 0;
  padding-bottom: 0;
  vertical-align: middle;
}
table.asof-table th:nth-child(3),
table.asof-table td:nth-child(3) { min-width: 7rem; }
table.asof-table th:nth-child(4),
table.asof-table td:nth-child(4) { min-width: 12rem; }

/* ---- Async states ---------------------------------------------------- */
.loading {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  color: var(--muted);
}
.loading::before {
  content: "";
  width: 1rem;
  height: 1rem;
  border-radius: 50%;
  border: 2px solid var(--border-strong);
  border-top-color: var(--accent);
  animation: srr-spin 0.7s linear infinite;
}
@media (prefers-reduced-motion: reduce) {
  .loading::before { animation-duration: 2s; }
  html { scroll-behavior: auto; }
}
/* The as-of table refreshes in place; its loading indicator floats over the
   top-right corner (absolute, out of flow) so the table never shifts down and
   back as fetches resolve on each slider move. */
.asof-results { position: relative; }
.asof-updating {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  z-index: 1;
  padding: 0.25rem 0.7rem;
  font-size: 0.85rem;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-pill);
  box-shadow: var(--shadow-sm);
}
@keyframes srr-spin { to { transform: rotate(360deg); } }

.error {
  color: var(--paused);
  border: 1px solid var(--warn-border);
  background: var(--warn-bg);
  border-radius: var(--radius);
  padding: 0.6rem 1rem;
}

.muted { color: var(--muted); }

/* Inline info glyph used by the notice (data-URI so no extra request). */
:root {
  --icon-info: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23000' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='10'/%3E%3Cpath d='M12 16v-4M12 8h.01'/%3E%3C/svg%3E");
}
`;
