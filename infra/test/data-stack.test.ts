import { describe, it } from "vitest";
import * as cdk from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { DataStack } from "../lib/data-stack.ts";

const template = (): Template => {
  const app = new cdk.App();
  const stack = new DataStack(app, "TestData", {
    env: { region: "us-west-2", account: "111111111111" },
  });
  return Template.fromStack(stack);
};

describe("DataStack — content-addressed snapshot store (ADR-0011)", () => {
  it("creates a single versioned, object-locked, private bucket", () => {
    const t = template();
    t.resourceCountIs("AWS::S3::Bucket", 1);
    t.hasResourceProperties("AWS::S3::Bucket", {
      VersioningConfiguration: { Status: "Enabled" },
      ObjectLockEnabled: true,
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
      BucketEncryption: Match.objectLike({
        ServerSideEncryptionConfiguration: Match.arrayWith([
          Match.objectLike({
            ServerSideEncryptionByDefault: { SSEAlgorithm: "AES256" },
          }),
        ]),
      }),
    });
  });

  it("retains the bucket on stack deletion (the corpus is durable)", () => {
    template().hasResource("AWS::S3::Bucket", {
      DeletionPolicy: "Retain",
      UpdateReplacePolicy: "Retain",
    });
  });

  it("denies non-TLS access via a bucket policy", () => {
    template().hasResourceProperties("AWS::S3::BucketPolicy", {
      PolicyDocument: Match.objectLike({
        Statement: Match.arrayWith([
          Match.objectLike({
            Effect: "Deny",
            Condition: { Bool: { "aws:SecureTransport": "false" } },
          }),
        ]),
      }),
    });
  });

  it("publishes the bucket name to SSM for soft cross-stack coupling", () => {
    template().hasResourceProperties("AWS::SSM::Parameter", {
      Name: "/sust-reg/s3/snapshot-bucket",
    });
  });
});

describe("DataStack — Aurora DSQL (ADR-0012)", () => {
  it("creates a single deletion-protected DSQL cluster", () => {
    const t = template();
    t.resourceCountIs("AWS::DSQL::Cluster", 1);
    t.hasResourceProperties("AWS::DSQL::Cluster", {
      DeletionProtectionEnabled: true,
    });
  });

  it("retains the cluster on stack deletion (the corpus is durable)", () => {
    template().hasResource("AWS::DSQL::Cluster", {
      DeletionPolicy: "Retain",
      UpdateReplacePolicy: "Retain",
    });
  });

  it("publishes the DSQL endpoint and cluster ARN to SSM", () => {
    const t = template();
    t.hasResourceProperties("AWS::SSM::Parameter", {
      Name: "/sust-reg/dsql/endpoint",
    });
    t.hasResourceProperties("AWS::SSM::Parameter", {
      Name: "/sust-reg/dsql/cluster-arn",
    });
  });
});
