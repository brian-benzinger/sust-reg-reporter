export type Route =
  | "health"
  | "sources"
  | "as-of"
  | "scope-check"
  | "diff"
  | "grounding"
  | "not-found";

/**
 * Map a request path to one of the thin API's routes (ADR-0013): the corpus
 * index (`/sources`), the three interactive features — as-of slider, scope
 * checker, diff view — plus a health check. The `/api` prefix and trailing
 * slashes are normalized away. Pure and unit-tested; the HTTP handler is a thin
 * wrapper over it.
 */
export function routeFor(path: string): Route {
  const p = normalize(path);
  if (p === "/health") return "health";
  if (p === "/sources") return "sources";
  if (p === "/as-of" || p.startsWith("/as-of/")) return "as-of";
  if (p === "/scope-check") return "scope-check";
  if (p === "/diff" || p.startsWith("/diff/")) return "diff";
  if (p === "/grounding") return "grounding";
  return "not-found";
}

/**
 * Extract the diff id from a diff-detail path (`/api/diff/{id}`), or `undefined`
 * for the diff-list path (`/api/diff`). The id segment is URL-decoded. Pure.
 */
export function diffIdFrom(path: string): string | undefined {
  const id = /^\/diff\/(.+)$/.exec(normalize(path))?.[1];
  return id === undefined ? undefined : decodeURIComponent(id);
}

function normalize(path: string): string {
  return path.replace(/^\/api/, "").replace(/\/+$/, "") || "/";
}
