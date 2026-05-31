import * as cdk from "aws-cdk-lib";
import { CostStack } from "../lib/cost-stack.ts";
import { DataStack } from "../lib/data-stack.ts";
import { PipelineStack } from "../lib/pipeline-stack.ts";
import {
  LogRetentionAspect,
  NoCostlyNetworkingAspect,
  SingleRegionAspect,
} from "../lib/aspects.ts";
import { appEnv, DEFAULT_BUDGET_EMAIL, DEFAULT_REGION } from "../lib/config.ts";

const app = new cdk.App();
const env = appEnv();

const budgetEmail =
  (app.node.tryGetContext("budgetEmail") as string | undefined) ??
  DEFAULT_BUDGET_EMAIL;

// Deployed FIRST and standalone so the cost guardrail exists before — and
// outlives — any billable resource (ADR-0016).
new CostStack(app, "SustReg-Cost", {
  env,
  budgetEmail,
  description:
    "sust-reg-reporter cost backstop: $1 monthly budget alarm, deployed first and standalone (ADR-0016).",
});

// Stateful, RETAIN data layer (ADR-0011): the immutable content-addressed
// snapshot store. (Aurora DSQL is added in a following PR.)
new DataStack(app, "SustReg-Data", {
  env,
  description:
    "sust-reg-reporter content-addressed immutable snapshot store (ADR-0011); Aurora DSQL added next.",
});

// Ingest pipeline (ADR-0010): scheduled ingestor + differ Lambdas. Stateless;
// consumes the DataStack handles (bucket, DSQL) via SSM.
new PipelineStack(app, "SustReg-Pipeline", {
  env,
  description:
    "sust-reg-reporter ingest pipeline: EventBridge-scheduled ingestor + differ Lambdas (ADR-0010).",
});

// Cost-discipline guardrails, enforced at synth time (ADR-0016, ADR-0014).
cdk.Aspects.of(app).add(new NoCostlyNetworkingAspect());
cdk.Aspects.of(app).add(new LogRetentionAspect(14));
cdk.Aspects.of(app).add(new SingleRegionAspect(DEFAULT_REGION));

cdk.Tags.of(app).add("project", "sust-reg-reporter");

app.synth();
