import * as cdk from "aws-cdk-lib";
import { aws_s3 as s3, aws_ssm as ssm } from "aws-cdk-lib";
import type { Construct } from "constructs";

/**
 * Stateful, RETAIN-policy data layer (ADR-0011, ADR-0012).
 *
 * Holds the immutable content-addressed snapshot bucket whose identity must
 * survive any compute redeploy. (Aurora DSQL is added in a following PR.) The
 * bucket name is published to SSM so the pipeline/serving stacks can consume it
 * without a hard CloudFormation export, keeping those stacks independently
 * destroyable.
 */
export class DataStack extends cdk.Stack {
  readonly snapshotBucket: s3.IBucket;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Raw immutable snapshots, keyed by content hash (ADR-0011): never
    // overwritten, every distinct version preserved. Object Lock + versioning
    // give write-once tamper-evidence; RETAIN keeps the corpus if the stack is
    // ever destroyed.
    this.snapshotBucket = new s3.Bucket(this, "SnapshotBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: true,
      objectLockEnabled: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    new ssm.StringParameter(this, "SsmSnapshotBucket", {
      parameterName: "/sust-reg/s3/snapshot-bucket",
      stringValue: this.snapshotBucket.bucketName,
      description: "Content-addressed immutable snapshot bucket name (ADR-0011).",
    });

    new cdk.CfnOutput(this, "SnapshotBucketName", {
      value: this.snapshotBucket.bucketName,
      description: "Content-addressed immutable snapshot store (ADR-0011).",
    });
  }
}
