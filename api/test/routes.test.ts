import { describe, it, expect } from "vitest";
import { routeFor, diffIdFrom } from "../src/routes.ts";

describe("routeFor (ADR-0013)", () => {
  it("maps the corpus index, interactive features, and health check", () => {
    expect(routeFor("/api/sources")).toBe("sources");
    expect(routeFor("/api/as-of")).toBe("as-of");
    expect(routeFor("/api/scope-check")).toBe("scope-check");
    expect(routeFor("/api/diff")).toBe("diff");
    expect(routeFor("/api/grounding")).toBe("grounding");
    expect(routeFor("/api/health")).toBe("health");
  });

  it("matches feature sub-paths (e.g. a regime or diff id)", () => {
    expect(routeFor("/api/as-of/ca-sb261")).toBe("as-of");
    expect(routeFor("/api/diff/change-123")).toBe("diff");
  });

  it("normalizes the /api prefix and trailing slashes", () => {
    expect(routeFor("/health")).toBe("health");
    expect(routeFor("/api/scope-check/")).toBe("scope-check");
  });

  it("returns not-found for unknown and root paths", () => {
    expect(routeFor("/api/unknown")).toBe("not-found");
    expect(routeFor("/api")).toBe("not-found");
    expect(routeFor("/")).toBe("not-found");
  });
});

describe("diffIdFrom (ADR-0013)", () => {
  it("extracts and URL-decodes the id from a diff-detail path", () => {
    expect(diffIdFrom("/api/diff/abc-123")).toBe("abc-123");
    expect(diffIdFrom("/api/diff/a%20b")).toBe("a b");
  });

  it("is undefined for the diff-list path (no id)", () => {
    expect(diffIdFrom("/api/diff")).toBeUndefined();
    expect(diffIdFrom("/api/diff/")).toBeUndefined();
  });

  it("is undefined for non-diff paths", () => {
    expect(diffIdFrom("/api/sources")).toBeUndefined();
  });
});
