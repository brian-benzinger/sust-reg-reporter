import { type Route, routeFor, diffIdFrom } from "./routes.ts";
import type { CorpusReader } from "./model.ts";

/**
 * Not-legal-advice framing carried on every response (ADR-0002): the API returns
 * primary-source text, citations, effective dates, and applicability metadata —
 * never advice.
 */
const DISCLAIMER =
  "Not legal advice. Returns primary-source text, citations, effective dates, and applicability metadata only.";

/** A normalized request: the raw path plus parsed query parameters. */
export interface ApiRequest {
  readonly path: string;
  readonly query: Record<string, string | undefined>;
}

/** The route layer's result, before HTTP serialization. */
export interface ApiResult {
  readonly status: number;
  readonly body: Record<string, unknown>;
}

/**
 * Serve a request against the corpus (ADR-0013). Pure given a `CorpusReader`:
 * resolves the route, reads what it needs, and shapes the JSON body. The HTTP
 * handler is a thin wrapper that builds the reader and serializes the result.
 *
 * Implemented now: the corpus index (`/sources`) and the diff view (`/diff`,
 * `/diff/{id}`), both backed by DSQL. The as-of slider and scope checker are
 * routed but not yet implemented (501) — they follow in later changes.
 */
export async function serveRoute(
  reader: CorpusReader,
  req: ApiRequest,
): Promise<ApiResult> {
  const route = routeFor(req.path);
  switch (route) {
    case "health":
      return ok(route, { status: "ok" });
    case "sources":
      return ok(route, { sources: await reader.listSources() });
    case "diff": {
      const id = diffIdFrom(req.path);
      if (id !== undefined) {
        const diff = await reader.getDiff(id);
        return diff
          ? ok(route, { diff })
          : { status: 404, body: meta(route, { message: `No diff "${id}".` }) };
      }
      return ok(route, { diffs: await reader.listDiffs(req.query.source) });
    }
    case "as-of":
    case "scope-check":
      return {
        status: 501,
        body: meta(route, {
          message: `The "${route}" endpoint is not yet implemented.`,
        }),
      };
    default:
      return { status: 404, body: meta(route, { message: "Unknown route." }) };
  }
}

function ok(route: Route, extra: Record<string, unknown>): ApiResult {
  return { status: 200, body: meta(route, extra) };
}

function meta(route: Route, extra: Record<string, unknown>): Record<string, unknown> {
  return { route, disclaimer: DISCLAIMER, ...extra };
}
