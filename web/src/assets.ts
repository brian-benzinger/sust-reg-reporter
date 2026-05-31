/**
 * Static assets emitted alongside the generated HTML.
 *
 * The stylesheet is a plain string constant rather than a build-tooled asset:
 * it keeps the web workspace free of runtime/build dependencies (ADR-0020) and
 * ships as a single cacheable file behind CloudFront (ADR-0014). System fonts,
 * no external requests, and a legible high-contrast palette — the site must be
 * usable by non-developers and indexable (ADR-0013).
 */

/** Root-relative URL of the generated stylesheet. */
export const STYLESHEET_PATH = "/styles.css";

export const STYLESHEET = `:root {
  --bg: #ffffff;
  --fg: #1a1c1e;
  --muted: #586069;
  --border: #d8dee4;
  --surface: #f6f8fa;
  --accent: #0b5fa5;
  --warn-bg: #fff8e6;
  --warn-border: #e3b341;
  --ok: #1a7f37;
  --paused: #9a6700;
  --link: #0b5fa5;
  --maxw: 56rem;
}

* { box-sizing: border-box; }

html { -webkit-text-size-adjust: 100%; }

body {
  margin: 0;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  line-height: 1.6;
  color: var(--fg);
  background: var(--bg);
}

a { color: var(--link); }
a:hover { text-decoration: none; }

.wrap { max-width: var(--maxw); margin: 0 auto; padding: 0 1.25rem; }

header.site {
  border-bottom: 1px solid var(--border);
  background: var(--surface);
}
header.site .wrap {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.5rem 1.25rem;
  padding-top: 1rem;
  padding-bottom: 1rem;
}
header.site .brand { font-weight: 700; font-size: 1.1rem; color: var(--fg); text-decoration: none; }
header.site nav { display: flex; gap: 1rem; margin-left: auto; }

main { padding: 2rem 0 3rem; }

h1 { font-size: 1.9rem; line-height: 1.2; margin: 0 0 0.75rem; }
h2 { font-size: 1.3rem; margin: 2rem 0 0.5rem; }
h3 { font-size: 1.05rem; margin: 1.25rem 0 0.25rem; }

p.lead { font-size: 1.15rem; color: var(--muted); margin-top: 0; }

.notice {
  border: 1px solid var(--warn-border);
  background: var(--warn-bg);
  border-radius: 8px;
  padding: 0.75rem 1rem;
  margin: 1.25rem 0;
  font-size: 0.95rem;
}

.card {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 1rem 1.25rem;
  margin: 0.75rem 0;
  background: var(--bg);
}
.card h3 { margin-top: 0; }
.card .meta { color: var(--muted); font-size: 0.9rem; }

.badge {
  display: inline-block;
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  padding: 0.1rem 0.5rem;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--fg);
}
.badge.status-enforced { border-color: var(--ok); color: var(--ok); }
.badge.status-in-effect { border-color: var(--accent); color: var(--accent); }
.badge.status-stayed { border-color: var(--paused); color: var(--paused); }
.badge.grounded { border-color: var(--ok); color: var(--ok); }
.badge.ungrounded { border-color: var(--warn-border); color: var(--paused); }

ul.facts { margin: 0.5rem 0; padding-left: 1.25rem; }
ul.facts li { margin: 0.2rem 0; }

dl.kv { display: grid; grid-template-columns: max-content 1fr; gap: 0.35rem 1rem; margin: 0.75rem 0; }
dl.kv dt { color: var(--muted); }
dl.kv dd { margin: 0; }

.feature-list { list-style: none; padding: 0; }
.feature-list li { margin: 0.75rem 0; }
.feature-list .soon { color: var(--muted); font-size: 0.85rem; }

footer.site {
  border-top: 1px solid var(--border);
  color: var(--muted);
  font-size: 0.85rem;
  padding: 1.5rem 0 2.5rem;
}
footer.site p { margin: 0.35rem 0; }
`;
