import { describe, it, expect } from "vitest";
import { handler } from "../src/handler.ts";

describe("api handler (ADR-0002, ADR-0013)", () => {
  it("returns 200 and the not-legal-advice framing for a known route", async () => {
    const res = await handler({ rawPath: "/api/scope-check" });
    expect(res.statusCode).toBe(200);
    expect(res.headers["x-disclaimer"]).toBe("not-legal-advice");
    const body = JSON.parse(res.body);
    expect(body.route).toBe("scope-check");
    expect(body.disclaimer).toContain("Not legal advice");
  });

  it("returns 404 for an unknown route", async () => {
    const res = await handler({ rawPath: "/api/nope" });
    expect(res.statusCode).toBe(404);
    expect(JSON.parse(res.body).route).toBe("not-found");
  });

  it("defaults the path when rawPath is absent", async () => {
    const res = await handler({});
    expect(res.statusCode).toBe(404);
  });
});
