export type Route = "health" | "as-of" | "scope-check" | "diff" | "not-found";

/**
 * Map a request path to one of the thin API's routes (ADR-0013): the three
 * interactive features — as-of slider, scope checker, diff view — plus a health
 * check. The `/api` prefix and trailing slashes are normalized away. Pure and
 * unit-tested; the HTTP handler is a thin wrapper over it.
 */
export function routeFor(path: string): Route {
  const p = path.replace(/^\/api/, "").replace(/\/+$/, "") || "/";
  if (p === "/health") return "health";
  if (p === "/as-of" || p.startsWith("/as-of/")) return "as-of";
  if (p === "/scope-check") return "scope-check";
  if (p === "/diff" || p.startsWith("/diff/")) return "diff";
  return "not-found";
}
