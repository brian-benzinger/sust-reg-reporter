import { describe, it } from "vitest";
import * as cdk from "aws-cdk-lib";
import { aws_ec2 as ec2, aws_logs as logs } from "aws-cdk-lib";
import { Annotations, Match } from "aws-cdk-lib/assertions";
import {
  LogRetentionAspect,
  NoCostlyNetworkingAspect,
  SingleRegionAspect,
} from "../lib/aspects.ts";

const WEST = { region: "us-west-2", account: "111111111111" };

describe("NoCostlyNetworkingAspect (ADR-0016, ADR-0014)", () => {
  it("flags a NAT Gateway", () => {
    const app = new cdk.App();
    const stack = new cdk.Stack(app, "S", { env: WEST });
    new ec2.CfnNatGateway(stack, "Nat", { subnetId: "subnet-123" });
    cdk.Aspects.of(stack).add(new NoCostlyNetworkingAspect());
    Annotations.fromStack(stack).hasError(
      "*",
      Match.stringLikeRegexp("Forbidden resource AWS::EC2::NatGateway"),
    );
  });

  it("allows a budget-only stack with no networking", () => {
    const app = new cdk.App();
    const stack = new cdk.Stack(app, "S", { env: WEST });
    new cdk.aws_budgets.CfnBudget(stack, "B", {
      budget: {
        budgetType: "COST",
        timeUnit: "MONTHLY",
        budgetLimit: { amount: 1, unit: "USD" },
      },
    });
    cdk.Aspects.of(stack).add(new NoCostlyNetworkingAspect());
    Annotations.fromStack(stack).hasNoError("*", Match.anyValue());
  });
});

describe("LogRetentionAspect (ADR-0016)", () => {
  const synth = (props: logs.CfnLogGroupProps) => {
    const app = new cdk.App();
    const stack = new cdk.Stack(app, "S", { env: WEST });
    new logs.CfnLogGroup(stack, "LG", props);
    cdk.Aspects.of(stack).add(new LogRetentionAspect(14));
    return Annotations.fromStack(stack);
  };

  it("flags a log group with no retention set", () => {
    synth({}).hasError("*", Match.stringLikeRegexp("retention must be set"));
  });

  it("flags retention longer than 14 days", () => {
    synth({ retentionInDays: 30 }).hasError(
      "*",
      Match.stringLikeRegexp("retention"),
    );
  });

  it("allows retention of 14 days or fewer", () => {
    synth({ retentionInDays: 14 }).hasNoError("*", Match.anyValue());
  });

  it("defaults the maximum to 14 days", () => {
    const app = new cdk.App();
    const stack = new cdk.Stack(app, "S", { env: WEST });
    new logs.CfnLogGroup(stack, "LG", { retentionInDays: 14 });
    cdk.Aspects.of(stack).add(new LogRetentionAspect());
    Annotations.fromStack(stack).hasNoError("*", Match.anyValue());
  });
});

describe("SingleRegionAspect (ADR-0016)", () => {
  it("flags a stack in the wrong region", () => {
    const app = new cdk.App();
    const stack = new cdk.Stack(app, "S", {
      env: { region: "eu-west-1", account: "111111111111" },
    });
    cdk.Aspects.of(stack).add(new SingleRegionAspect("us-west-2"));
    Annotations.fromStack(stack).hasError(
      "*",
      Match.stringLikeRegexp("single-region us-west-2"),
    );
  });

  it("allows a stack in the project region", () => {
    const app = new cdk.App();
    const stack = new cdk.Stack(app, "S", { env: WEST });
    cdk.Aspects.of(stack).add(new SingleRegionAspect("us-west-2"));
    Annotations.fromStack(stack).hasNoError("*", Match.anyValue());
  });

  it("skips a region-agnostic stack (region is an unresolved token)", () => {
    const app = new cdk.App();
    const stack = new cdk.Stack(app, "S");
    cdk.Aspects.of(stack).add(new SingleRegionAspect("us-west-2"));
    Annotations.fromStack(stack).hasNoError("*", Match.anyValue());
  });
});
