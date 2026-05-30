import { describe, it, expect } from "vitest";
import * as cdk from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { CostStack, assertValidBudgetEmail } from "../lib/cost-stack.ts";

const templateFor = (email: string): Template => {
  const app = new cdk.App();
  const stack = new CostStack(app, "TestCost", { budgetEmail: email });
  return Template.fromStack(stack);
};

describe("CostStack — $1 budget backstop (ADR-0016)", () => {
  it("creates exactly one $1 MONTHLY COST budget", () => {
    const t = templateFor("ops@example.org");
    t.resourceCountIs("AWS::Budgets::Budget", 1);
    t.hasResourceProperties("AWS::Budgets::Budget", {
      Budget: Match.objectLike({
        BudgetType: "COST",
        TimeUnit: "MONTHLY",
        BudgetLimit: { Amount: 1, Unit: "USD" },
      }),
    });
  });

  it("emails the subscriber on 80% actual and 100% forecasted spend", () => {
    const t = templateFor("ops@example.org");
    t.hasResourceProperties("AWS::Budgets::Budget", {
      NotificationsWithSubscribers: Match.arrayWith([
        Match.objectLike({
          Notification: Match.objectLike({
            NotificationType: "ACTUAL",
            Threshold: 80,
          }),
          Subscribers: [
            { SubscriptionType: "EMAIL", Address: "ops@example.org" },
          ],
        }),
        Match.objectLike({
          Notification: Match.objectLike({
            NotificationType: "FORECASTED",
            Threshold: 100,
          }),
          Subscribers: [
            { SubscriptionType: "EMAIL", Address: "ops@example.org" },
          ],
        }),
      ]),
    });
  });

  it("honors a custom limit", () => {
    const app = new cdk.App();
    const stack = new CostStack(app, "TestCost2", {
      budgetEmail: "ops@example.org",
      limitUsd: 5,
    });
    Template.fromStack(stack).hasResourceProperties("AWS::Budgets::Budget", {
      Budget: Match.objectLike({ BudgetLimit: { Amount: 5, Unit: "USD" } }),
    });
  });
});

describe("assertValidBudgetEmail (ADR-0016)", () => {
  it("accepts and trims a real address", () => {
    expect(assertValidBudgetEmail("  ops@example.org  ")).toBe(
      "ops@example.org",
    );
  });

  it.each(["", "   ", "you@example.com", "changeme@example.com", "notanemail"])(
    "rejects %j so the alarm is never silently disabled",
    (bad) => {
      expect(() => assertValidBudgetEmail(bad)).toThrow(/budgetEmail/);
    },
  );
});
