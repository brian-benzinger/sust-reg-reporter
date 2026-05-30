import { describe, it, expect } from "vitest";
import {
  isCurrentlyEnforced,
  isLaw,
  isRegulationStatus,
  REGULATION_STATUSES,
} from "../src/status.ts";

describe("regulation status states (ADR-0006)", () => {
  it("enumerates exactly the four explicit states", () => {
    expect([...REGULATION_STATUSES]).toEqual([
      "proposed",
      "in-effect",
      "enforced",
      "stayed",
    ]);
  });

  it("treats in-effect, enforced, and stayed as law on the books", () => {
    expect(isLaw("in-effect")).toBe(true);
    expect(isLaw("enforced")).toBe(true);
    expect(isLaw("stayed")).toBe(true);
  });

  it("does not treat a proposed rule as law", () => {
    expect(isLaw("proposed")).toBe(false);
  });

  it("treats only enforced as currently enforced (the stayed distinction)", () => {
    expect(isCurrentlyEnforced("enforced")).toBe(true);
    expect(isCurrentlyEnforced("stayed")).toBe(false);
    expect(isCurrentlyEnforced("in-effect")).toBe(false);
    expect(isCurrentlyEnforced("proposed")).toBe(false);
  });

  it("guards unknown values", () => {
    expect(isRegulationStatus("enforced")).toBe(true);
    expect(isRegulationStatus("active")).toBe(false);
    expect(isRegulationStatus(undefined)).toBe(false);
  });
});
