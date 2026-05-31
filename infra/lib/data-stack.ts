import * as cdk from "aws-cdk-lib";
import { aws_dsql as dsql, aws_s3 as s3, aws_ssm as ssm } from "aws-cdk-lib";
import type { Construct } from "constructs";

/**
 * Stateful, RETAIN-policy data layer (ADR-0011, ADR-0012).
 *
 * Holds the two durable resources whose identity must survive any compute
 * redeploy: the immutable content-addressed snapshot bucket and the Aurora DSQL
 * cluster. Their handles (bucket name, DSQL endpoint, DSQL ARN) are published to
 * SSM so the pipeline/serving stacks consume them without a hard CloudFormation
 * export, keeping those stacks independently destroyable.
 */
export class DataStack extends cdk.Stack {
  readonly snapshotBucket: s3.IBucket;
  /** Aurora DSQL connection endpoint (Postgres wire protocol, IAM-token auth). */
  readonly dsqlEndpoint: string;
  /** Aurora DSQL cluster ARN — used to grant `dsql:DbConnect` to compute. */
  readonly dsqlClusterArn: string;

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

    // Aurora DSQL — the queryable bitemporal corpus, metadata index, and
    // applicability data (ADR-0012). Postgres-compatible, serverless, scales to
    // zero, ongoing Always-Free tier. Reached over its public TLS endpoint with
    // IAM-token auth — no VPC, no TCP pool (ADR-0010). Deletion-protected and
    // RETAIN so the corpus is durable across any compute churn.
    const cluster = new dsql.CfnCluster(this, "DsqlCluster", {
      deletionProtectionEnabled: true,
      tags: [{ key: "project", value: "sust-reg-reporter" }],
    });
    cluster.applyRemovalPolicy(cdk.RemovalPolicy.RETAIN);

    this.dsqlEndpoint = cluster.attrEndpoint;
    this.dsqlClusterArn = cluster.attrResourceArn;

    new ssm.StringParameter(this, "SsmDsqlEndpoint", {
      parameterName: "/sust-reg/dsql/endpoint",
      stringValue: this.dsqlEndpoint,
      description: "Aurora DSQL connection endpoint (ADR-0012).",
    });

    new ssm.StringParameter(this, "SsmDsqlClusterArn", {
      parameterName: "/sust-reg/dsql/cluster-arn",
      stringValue: this.dsqlClusterArn,
      description: "Aurora DSQL cluster ARN for dsql:DbConnect grants (ADR-0012).",
    });

    new cdk.CfnOutput(this, "DsqlEndpoint", {
      value: this.dsqlEndpoint,
      description: "Aurora DSQL connection endpoint (ADR-0012).",
    });

    new cdk.CfnOutput(this, "DsqlClusterArn", {
      value: this.dsqlClusterArn,
      description: "Aurora DSQL cluster ARN (ADR-0012).",
    });
  }
}
