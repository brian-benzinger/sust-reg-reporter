import * as cdk from "aws-cdk-lib";
import * as budgets from "aws-cdk-lib/aws-budgets";
import type { Construct } from "constructs";

export interface CostStackProps extends cdk.StackProps {
  /** Verified email for budget notifications (ADR-0016). */
  readonly budgetEmail: string;
  /** Monthly USD limit; defaults to 1. */
  readonly limitUsd?: number;
}

/**
 * Addresses that look like a copy-paste placeholder rather than a real inbox.
 * A budget alarm that emails nobody is worse than useless, so these are
 * rejected at synth time (risk: the alarm silently disabled by a bad address).
 */
const PLACEHOLDER_EMAILS = new Set(["you@example.com", "changeme@example.com"]);

/** Fail fast if the budget email is missing or obviously a placeholder. */
export function assertValidBudgetEmail(email: string): string {
  const trimmed = email.trim();
  if (
    trimmed.length === 0 ||
    PLACEHOLDER_EMAILS.has(trimmed) ||
    !trimmed.includes("@")
  ) {
    throw new Error(
      `CostStack: a real budgetEmail is required for the $1 budget alarm (ADR-0016); got ${JSON.stringify(email)}`,
    );
  }
  return trimmed;
}

/**
 * Day-one cost backstop (ADR-0016). A $1 monthly AWS Budget that emails on 80%
 * actual and 100% forecasted spend. Deployed first and standing alone so a
 * `cdk destroy` of compute can never remove the guardrail of last resort, and
 * so it exists before any billable resource does.
 */
export class CostStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: CostStackProps) {
    super(scope, id, props);

    const email = assertValidBudgetEmail(props.budgetEmail);
    const limitUsd = props.limitUsd ?? 1;
    const budgetName = "sust-reg-monthly-usd1";

    new budgets.CfnBudget(this, "MonthlyBudget", {
      budget: {
        budgetName,
        budgetType: "COST",
        timeUnit: "MONTHLY",
        budgetLimit: { amount: limitUsd, unit: "USD" },
      },
      notificationsWithSubscribers: [
        {
          notification: {
            notificationType: "ACTUAL",
            comparisonOperator: "GREATER_THAN",
            threshold: 80,
            thresholdType: "PERCENTAGE",
          },
          subscribers: [{ subscriptionType: "EMAIL", address: email }],
        },
        {
          notification: {
            notificationType: "FORECASTED",
            comparisonOperator: "GREATER_THAN",
            threshold: 100,
            thresholdType: "PERCENTAGE",
          },
          subscribers: [{ subscriptionType: "EMAIL", address: email }],
        },
      ],
    });

    new cdk.CfnOutput(this, "BudgetName", {
      value: budgetName,
      description: "Name of the $1 monthly cost-guardrail budget (ADR-0016).",
    });
  }
}
