import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isCurrentlyEnforced,
  isLaw,
  isRegulationStatus,
  REGULATION_STATUSES,
} from "../src/status.ts";

describe("regulation status states (ADR-0006)", () => {
  it("enumerates exactly the four explicit states", () => {
    assert.deepEqual(
      [...REGULATION_STATUSES],
      ["proposed", "in-effect", "enforced", "stayed"],
    );
  });

  it("treats in-effect, enforced, and stayed as law on the books", () => {
    assert.equal(isLaw("in-effect"), true);
    assert.equal(isLaw("enforced"), true);
    assert.equal(isLaw("stayed"), true);
  });

  it("does not treat a proposed rule as law", () => {
    assert.equal(isLaw("proposed"), false);
  });

  it("treats only enforced as currently enforced (the stayed distinction)", () => {
    assert.equal(isCurrentlyEnforced("enforced"), true);
    assert.equal(isCurrentlyEnforced("stayed"), false);
    assert.equal(isCurrentlyEnforced("in-effect"), false);
    assert.equal(isCurrentlyEnforced("proposed"), false);
  });

  it("guards unknown values", () => {
    assert.equal(isRegulationStatus("enforced"), true);
    assert.equal(isRegulationStatus("active"), false);
    assert.equal(isRegulationStatus(undefined), false);
  });
});
