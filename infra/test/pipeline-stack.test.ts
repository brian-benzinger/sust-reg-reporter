import { describe, it, expect } from "vitest";
import * as cdk from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { PipelineStack } from "../lib/pipeline-stack.ts";

// Built once — synth bundles the Lambda handlers via esbuild, which is slow to
// repeat per test.
const app = new cdk.App();
const stack = new PipelineStack(app, "TestPipeline", {
  env: { region: "us-west-2", account: "111111111111" },
});
const t = Template.fromStack(stack);

describe("PipelineStack (ADR-0010)", () => {
  it("provisions the ingestor and differ as ARM64 Node 22 functions", () => {
    t.resourceCountIs("AWS::Lambda::Function", 2);
    t.hasResourceProperties("AWS::Lambda::Function", {
      Runtime: "nodejs22.x",
      Architectures: ["arm64"],
    });
  });

  it("bounds every log group to 14-day retention (ADR-0016)", () => {
    const groups = t.findResources("AWS::Logs::LogGroup");
    const retentions = Object.values(groups).map(
      (g) => (g.Properties as { RetentionInDays?: number }).RetentionInDays,
    );
    expect(retentions.length).toBe(2);
    expect(retentions.every((r) => r === 14)).toBe(true);
  });

  it("schedules a daily cron to the ingestor with a dead-letter queue", () => {
    t.resourceCountIs("AWS::SQS::Queue", 1);
    t.hasResourceProperties("AWS::Scheduler::Schedule", {
      ScheduleExpression: "cron(0 6 * * ? *)",
      Target: Match.objectLike({
        DeadLetterConfig: Match.objectLike({ Arn: Match.anyValue() }),
      }),
    });
  });

  it("grants the functions dsql:DbConnect on the cluster", () => {
    t.hasResourceProperties("AWS::IAM::Policy", {
      PolicyDocument: Match.objectLike({
        Statement: Match.arrayWith([
          Match.objectLike({ Action: "dsql:DbConnect" }),
        ]),
      }),
    });
  });

  it("grants the differ read of the Anthropic key SecureString (ADR-0024)", () => {
    t.hasResourceProperties("AWS::IAM::Policy", {
      PolicyDocument: Match.objectLike({
        Statement: Match.arrayWith([
          Match.objectLike({ Action: "ssm:GetParameter" }),
        ]),
      }),
    });
  });

  it("has NO public invoke path — the LLM analysis is async only (ADR-0007)", () => {
    // The differ (which calls Claude via semdiff) must never be reachable on
    // demand: no Function URL, no API Gateway anywhere in the pipeline.
    t.resourceCountIs("AWS::Lambda::Url", 0);
    t.resourceCountIs("AWS::ApiGatewayV2::Api", 0);
    t.resourceCountIs("AWS::ApiGateway::RestApi", 0);
  });
});
