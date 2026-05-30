import * as cdk from "aws-cdk-lib";
import { CostStack } from "../lib/cost-stack.ts";
import { appEnv, DEFAULT_BUDGET_EMAIL } from "../lib/config.ts";

const app = new cdk.App();

const budgetEmail =
  (app.node.tryGetContext("budgetEmail") as string | undefined) ??
  DEFAULT_BUDGET_EMAIL;

// Deployed FIRST and standalone so the cost guardrail exists before — and
// outlives — any billable resource (ADR-0016).
new CostStack(app, "SustReg-Cost", {
  env: appEnv(),
  budgetEmail,
  description:
    "sust-reg-reporter cost backstop: $1 monthly budget alarm, deployed first and standalone (ADR-0016).",
});

cdk.Tags.of(app).add("project", "sust-reg-reporter");

app.synth();
