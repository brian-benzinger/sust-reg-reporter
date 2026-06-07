import { describe, it, expect } from "vitest";
import * as cdk from "aws-cdk-lib";
import { aws_certificatemanager as acm } from "aws-cdk-lib";
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

  it("grants the api Lambda least-privilege DSQL: DbConnect, never DbConnectAdmin", () => {
    t.hasResourceProperties("AWS::IAM::Policy", {
      PolicyDocument: Match.objectLike({
        Statement: Match.arrayWith([
          Match.objectLike({ Action: "dsql:DbConnect" }),
        ]),
      }),
    });
    const policies = t.findResources("AWS::IAM::Policy");
    const json = JSON.stringify(policies);
    expect(json).toContain("dsql:DbConnect");
    expect(json).not.toContain("dsql:DbConnectAdmin");
  });

  it("connects the api Lambda as the read-only api_reader role", () => {
    t.hasResourceProperties("AWS::Lambda::Function", {
      Environment: { Variables: Match.objectLike({ DSQL_DB_ROLE: "api_reader" }) },
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

  it("publishes the site via a CDK BucketDeployment that invalidates CloudFront (ADR-0026)", () => {
    t.resourceCountIs("Custom::CDKBucketDeployment", 1);
    t.hasResourceProperties("Custom::CDKBucketDeployment", {
      Prune: true,
      DistributionPaths: ["/*"],
    });
  });

  it("bounds every serving log group to 14 days (ADR-0016)", () => {
    const groups = t.findResources("AWS::Logs::LogGroup");
    const retentions = Object.values(groups).map(
      (g) => (g.Properties as { RetentionInDays?: number }).RetentionInDays,
    );
    // The api Lambda and the BucketDeployment helper both have explicit groups.
    expect(retentions.length).toBeGreaterThanOrEqual(2);
    expect(retentions.every((r) => r === 14)).toBe(true);
  });
});

describe("ServingStack with a custom domain (ADR-0031, ADR-0032)", () => {
  const CERT_ARN = "arn:aws:acm:us-east-1:111111111111:certificate/test";
  const cdApp = new cdk.App();
  // The cert lives in a us-east-1 stack so CloudFront's region check passes;
  // imported by a concrete ARN, so no cross-region reference is exercised here.
  const certStack = new cdk.Stack(cdApp, "Cert", {
    env: { account: "111111111111", region: "us-east-1" },
  });
  const cdStack = new ServingStack(cdApp, "ServingCD", {
    env: { region: "us-west-2", account: "111111111111" },
    customDomain: {
      domainName: "disclosurelab.dev",
      certificate: acm.Certificate.fromCertificateArn(certStack, "C", CERT_ARN),
      hostedZoneId: "Z123456789ABCDEFGHIJ",
    },
  });
  const tcd = Template.fromStack(cdStack);

  it("serves the apex + www on the distribution with the provided cert", () => {
    tcd.hasResourceProperties("AWS::CloudFront::Distribution", {
      DistributionConfig: Match.objectLike({
        Aliases: Match.arrayWith(["disclosurelab.dev", "www.disclosurelab.dev"]),
        ViewerCertificate: Match.objectLike({ AcmCertificateArn: CERT_ARN }),
      }),
    });
  });

  it("301s www -> apex with a CloudFront Function on the viewer request", () => {
    tcd.resourceCountIs("AWS::CloudFront::Function", 1);
    tcd.hasResourceProperties("AWS::CloudFront::Distribution", {
      DistributionConfig: Match.objectLike({
        DefaultCacheBehavior: Match.objectLike({
          FunctionAssociations: Match.arrayWith([
            Match.objectLike({ EventType: "viewer-request" }),
          ]),
        }),
      }),
    });
  });

  it("aliases apex + www (A and AAAA) at the zone to CloudFront", () => {
    const records = tcd.findResources("AWS::Route53::RecordSet");
    const types = Object.values(records).map(
      (r) => (r.Properties as { Type?: string }).Type,
    );
    expect(types.filter((x) => x === "A")).toHaveLength(2);
    expect(types.filter((x) => x === "AAAA")).toHaveLength(2);
    const allAlias = Object.values(records).every(
      (r) => (r.Properties as { AliasTarget?: unknown }).AliasTarget !== undefined,
    );
    expect(allAlias).toBe(true);
  });

  it("outputs the custom-domain URL", () => {
    expect(Object.keys(tcd.findOutputs("SiteUrl"))).toHaveLength(1);
  });
});
