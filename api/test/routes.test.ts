import { describe, it, expect } from "vitest";
import { routeFor } from "../src/routes.ts";

describe("routeFor (ADR-0013)", () => {
  it("maps the three interactive features and the health check", () => {
    expect(routeFor("/api/as-of")).toBe("as-of");
    expect(routeFor("/api/scope-check")).toBe("scope-check");
    expect(routeFor("/api/diff")).toBe("diff");
    expect(routeFor("/api/health")).toBe("health");
  });

  it("matches feature sub-paths (e.g. a regime or change id)", () => {
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
