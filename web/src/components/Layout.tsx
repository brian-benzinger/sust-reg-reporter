import type { ReactNode } from "react";
import { NOT_LEGAL_ADVICE, SITE_NAME } from "../content.ts";
import { STYLESHEET_PATH } from "../styles.ts";

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
        <title>{title}</title>
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
        <header className="site">
          <div className="wrap">
            <a className="brand" href="/index.html">
              {SITE_NAME}
            </a>
            <nav>
              <a href="/index.html">Home</a>
              <a href="/regimes/index.html">Regimes</a>
              <a href="/scope-checker.html">Scope checker</a>
              <a href="/as-of.html">As-of date</a>
            </nav>
          </div>
        </header>
        <main>
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
          </div>
        </footer>
      </body>
    </html>
  );
}
