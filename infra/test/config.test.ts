import { describe, it, expect } from "vitest";
import {
  appEnv,
  BUDGET_LIMIT_USD,
  DEFAULT_BUDGET_EMAIL,
  DEFAULT_REGION,
} from "../lib/config.ts";

describe("infra config (ADR-0016)", () => {
  it("uses CDK_DEPLOY_REGION when set", () => {
    const prev = process.env.CDK_DEPLOY_REGION;
    process.env.CDK_DEPLOY_REGION = "eu-west-1";
    try {
      expect(appEnv().region).toBe("eu-west-1");
    } finally {
      if (prev === undefined) delete process.env.CDK_DEPLOY_REGION;
      else process.env.CDK_DEPLOY_REGION = prev;
    }
  });

  it("falls back to the default region", () => {
    const prev = process.env.CDK_DEPLOY_REGION;
    delete process.env.CDK_DEPLOY_REGION;
    try {
      expect(appEnv().region).toBe(DEFAULT_REGION);
    } finally {
      if (prev !== undefined) process.env.CDK_DEPLOY_REGION = prev;
    }
  });

  it("pins the budget backstop to $1 and a real default email", () => {
    expect(BUDGET_LIMIT_USD).toBe(1);
    expect(DEFAULT_BUDGET_EMAIL).toContain("@");
  });
});
