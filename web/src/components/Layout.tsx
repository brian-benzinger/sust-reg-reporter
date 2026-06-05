import type { ReactNode } from "react";
import { NOT_LEGAL_ADVICE, SITE_NAME } from "../content.ts";
import { FAVICON_PATH, GitHubIcon, LeafIcon, LinkedInIcon } from "../icon.tsx";
import { NAV_ID, NAV_INIT_SCRIPT } from "../nav.ts";
import { STYLESHEET_PATH } from "../styles.ts";
import { THEME_INIT_SCRIPT } from "../theme.ts";
import { NavToggle } from "./NavToggle.tsx";
import { ThemeToggle } from "./ThemeToggle.tsx";

/** Root-relative URL of the hydration bundle emitted by webpack. */
export const CLIENT_SCRIPT_PATH = "/app.js";

export interface LayoutProps {
  readonly title: string;
  readonly description?: string;
  readonly canonicalPath?: string;
  /** Include the hydration bundle (only pages with interactive islands need it). */
  readonly withClient?: boolean;
  readonly children: ReactNode;
}

/**
 * The shared document shell. Renders the full <html> document so the prerender
 * step can serialize a complete, indexable page (ADR-0013); the "not legal
 * advice" notice (ADR-0002) is in the footer of every page.
 */
export function Layout(props: LayoutProps): React.ReactElement {
  const { title, description, canonicalPath, withClient, children } = props;
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {/* Apply the stored/system theme before first paint (ADR-0029) so
            there is no flash of the wrong theme; runs on every page, including
            the static ones that never load the hydration bundle. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        {/* Drive the mobile hamburger menu on every page, including the static
            ones that never load the hydration bundle (nav.ts). */}
        <script dangerouslySetInnerHTML={{ __html: NAV_INIT_SCRIPT }} />
        <meta
          name="theme-color"
          media="(prefers-color-scheme: light)"
          content="#ffffff"
        />
        <meta
          name="theme-color"
          media="(prefers-color-scheme: dark)"
          content="#0d1117"
        />
        <title>{title}</title>
        <link rel="icon" type="image/svg+xml" href={FAVICON_PATH} />
        {description !== undefined ? (
          <meta name="description" content={description} />
        ) : null}
        {canonicalPath !== undefined ? (
          <link rel="canonical" href={canonicalPath} />
        ) : null}
        <link rel="stylesheet" href={STYLESHEET_PATH} />
        {withClient === true ? (
          <script defer src={CLIENT_SCRIPT_PATH}></script>
        ) : null}
      </head>
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <header className="site">
          <div className="wrap">
            <a className="brand" href="/index.html">
              <LeafIcon />
              {SITE_NAME}
            </a>
            <nav id={NAV_ID} aria-label="Primary">
              <a href="/index.html">Home</a>
              <a href="/regimes/index.html">Regimes</a>
              <a href="/scope-checker.html">Scope checker</a>
              <a href="/as-of.html">As-of date</a>
              <a href="/diffs.html">Change history</a>
              <a href="/sources.html">Sources</a>
            </nav>
            <div className="header-controls">
              <ThemeToggle />
              <NavToggle />
            </div>
          </div>
        </header>
        <main id="main">
          <div className="wrap">{children}</div>
        </main>
        <footer className="site">
          <div className="wrap">
            <nav className="footer-nav">
              <a href="/status-states.html">Status states</a>
              <a href="/methodology.html">Methodology</a>
            </nav>
            <p>
              <strong>{NOT_LEGAL_ADVICE}</strong>
            </p>
            <p>
              Version-tracked climate disclosure regulations &middot;
              primary-source pinned.
            </p>
            <div className="footer-meta">
              <p className="copyright">&copy; 2026 Brian Benzinger</p>
              <nav className="footer-social" aria-label="Author links">
                <a
                  href="https://github.com/brian-benzinger"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="GitHub"
                >
                  <GitHubIcon />
                </a>
                <a
                  href="https://www.linkedin.com/in/brianbenzinger/"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="LinkedIn"
                >
                  <LinkedInIcon />
                </a>
              </nav>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
