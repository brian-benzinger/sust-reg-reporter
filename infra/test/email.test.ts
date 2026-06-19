import { describe, it, expect } from "vitest";
import { assertValidEmail } from "../lib/email.ts";

describe("assertValidEmail (ADR-0016, ADR-0033)", () => {
  it("accepts and trims a real address", () => {
    expect(assertValidEmail("  ops@example.org  ", "alertEmail")).toBe(
      "ops@example.org",
    );
  });

  it.each(["", "   ", "you@example.com", "changeme@example.com", "notanemail"])(
    "rejects %j so the alert is never silently disabled",
    (bad) => {
      expect(() => assertValidEmail(bad, "alertEmail")).toThrow(/alertEmail/);
    },
  );
});
