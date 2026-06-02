import { serveRoute } from "../corpus.ts";
import { dsqlCorpusReader } from "../io/corpus.ts";

/**
 * Thin API Lambda (ADR-0013, ADR-0023) behind an API Gateway HTTP API fronted by
 * CloudFront — the Lambda is never publicly invokable. This is glue: it parses
 * the API Gateway v2 event, delegates to the pure `serveRoute`, and serializes
 * the result. The corpus reader is built once per cold start (it holds no
 * connection; each query connects per invocation — ADR-0012).
 */
interface ApiGatewayV2Event {
  readonly rawPath?: string;
  readonly queryStringParameters?: Record<string, string | undefined> | null;
}

interface ApiResponse {
  readonly statusCode: number;
  readonly headers: Record<string, string>;
  readonly body: string;
}

const reader = dsqlCorpusReader();

export async function handler(event: ApiGatewayV2Event): Promise<ApiResponse> {
  const result = await serveRoute(reader, {
    path: event.rawPath ?? "/",
    query: event.queryStringParameters ?? {},
  });
  return {
    statusCode: result.status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "x-disclaimer": "not-legal-advice",
    },
    body: JSON.stringify(result.body),
  };
}
