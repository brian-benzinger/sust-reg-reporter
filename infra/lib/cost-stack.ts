import * as cdk from "aws-cdk-lib";
import * as budgets from "aws-cdk-lib/aws-budgets";
import type { Construct } from "constructs";
import { assertValidEmail } from "./email.ts";

export interface CostStackProps extends cdk.StackProps {
  /** Verified email for budget notifications (ADR-0016). */
  readonly budgetEmail: string;
  /** Monthly USD limit; defaults to 1. */
  readonly limitUsd?: number;
}

/**
 * Fail fast if the budget email is missing or obviously a placeholder, so the
 * $1 alarm (ADR-0016) is never deployed emailing nobody. Thin wrapper over the
 * shared {@link assertValidEmail} (also used by the pipeline alerts, ADR-0033).
 */
export function assertValidBudgetEmail(email: string): string {
  return assertValidEmail(email, "budgetEmail");
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
