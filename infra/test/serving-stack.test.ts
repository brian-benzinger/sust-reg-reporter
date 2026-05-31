import { describe, it, expect } from "vitest";
import * as cdk from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { ServingStack } from "../lib/serving-stack.ts";

const app = new cdk.App();
const stack = new ServingStack(app, "TestServing", {
  env: { region: "us-west-2", account: "111111111111" },
});
const t = Template.fromStack(stack);

describe("ServingStack (ADR-0013, ADR-0023)", () => {
  it("serves a private web bucket (all public access blocked)", () => {
    t.hasResourceProperties("AWS::S3::Bucket", {
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
    });
  });

  it("exposes the API via a throttled HTTP API, not a public Lambda URL", () => {
    t.resourceCountIs("AWS::Lambda::Url", 0);
    t.hasResourceProperties("AWS::ApiGatewayV2::Api", { ProtocolType: "HTTP" });
    t.hasResourceProperties("AWS::ApiGatewayV2::Stage", {
      StageName: "$default",
      DefaultRouteSettings: Match.objectLike({
        ThrottlingRateLimit: 50,
        ThrottlingBurstLimit: 100,
      }),
    });
  });

  it("runs the api Lambda as ARM64 Node 22", () => {
    t.hasResourceProperties("AWS::Lambda::Function", {
      Runtime: "nodejs22.x",
      Architectures: ["arm64"],
    });
  });

  it("fronts both the site and /api/* with a single CloudFront distribution", () => {
    t.resourceCountIs("AWS::CloudFront::Distribution", 1);
    t.hasResourceProperties("AWS::CloudFront::Distribution", {
      DistributionConfig: Match.objectLike({
        DefaultRootObject: "index.html",
        CacheBehaviors: Match.arrayWith([
          Match.objectLike({ PathPattern: "/api/*" }),
        ]),
      }),
    });
  });

  it("bounds the api log group to 14 days (ADR-0016)", () => {
    const groups = t.findResources("AWS::Logs::LogGroup");
    const retentions = Object.values(groups).map(
      (g) => (g.Properties as { RetentionInDays?: number }).RetentionInDays,
    );
    expect(retentions.length).toBeGreaterThanOrEqual(1);
    expect(retentions.every((r) => r === 14)).toBe(true);
  });
});
