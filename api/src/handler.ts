import { routeFor, type Route } from "./routes.ts";

/**
 * Not-legal-advice framing carried on every response (ADR-0002): the API
 * returns primary-source text, citations, effective dates, and applicability
 * metadata — never advice.
 */
const DISCLAIMER =
  "Not legal advice. Returns primary-source text, citations, effective dates, and applicability metadata only.";

interface FunctionUrlEvent {
  readonly rawPath?: string;
}

interface ApiResponse {
  readonly statusCode: number;
  readonly headers: Record<string, string>;
  readonly body: string;
}

/**
 * Thin API Lambda (ADR-0013, ADR-0014) behind a CloudFront-fronted Function URL.
 * This is the routing scaffold; the as-of slider, scope checker, and diff view
 * are implemented over the `core` domain types in following changes.
 */
export async function handler(event: FunctionUrlEvent): Promise<ApiResponse> {
  const route: Route = routeFor(event.rawPath ?? "/");
  const body = {
    route,
    disclaimer: DISCLAIMER,
    message:
      route === "not-found"
        ? "Unknown route."
        : `The "${route}" endpoint is not yet implemented.`,
  };
  return {
    statusCode: route === "not-found" ? 404 : 200,
    headers: {
      "content-type": "application/json",
      "x-disclaimer": "not-legal-advice",
    },
    body: JSON.stringify(body),
  };
}
