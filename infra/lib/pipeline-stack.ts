import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as cdk from "aws-cdk-lib";
import {
  aws_iam as iam,
  aws_lambda as lambda,
  aws_logs as logs,
  aws_s3 as s3,
  aws_scheduler as scheduler,
  aws_sqs as sqs,
  aws_ssm as ssm,
} from "aws-cdk-lib";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import type { Construct } from "constructs";

const HANDLERS = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "ingest",
  "src",
  "handlers",
);

/**
 * Ingest side of the serverless pipeline (ADR-0010):
 * EventBridge Scheduler (cron) -> ingestor Lambda -> (on content-hash change)
 * S3 snapshot write + async differ Lambda -> Aurora DSQL.
 *
 * Stateless and safe to destroy/redeploy. Consumes the DataStack handles via
 * SSM (soft coupling — no hard CloudFormation exports), so the durable corpus
 * can never be torn down with the compute. No VPC, no NAT: DSQL and S3 are
 * reached over their public TLS endpoints (ADR-0010, ADR-0016).
 */
export class PipelineStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const snapshotBucketName = ssm.StringParameter.valueForStringParameter(
      this,
      "/sust-reg/s3/snapshot-bucket",
    );
    const dsqlEndpoint = ssm.StringParameter.valueForStringParameter(
      this,
      "/sust-reg/dsql/endpoint",
    );
    const dsqlClusterArn = ssm.StringParameter.valueForStringParameter(
      this,
      "/sust-reg/dsql/cluster-arn",
    );

    const snapshotBucket = s3.Bucket.fromBucketName(
      this,
      "SnapshotBucket",
      snapshotBucketName,
    );

    // Reused: permission to open an IAM-authed connection to the DSQL cluster.
    const dsqlConnect = new iam.PolicyStatement({
      actions: ["dsql:DbConnect"],
      resources: [dsqlClusterArn],
    });

    const common = {
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      handler: "handler",
      reservedConcurrentExecutions: 1,
      bundling: { minify: true },
    } as const;

    // Differ — runs semdiff on a changed snapshot (gated by the ingestor).
    const differFn = new NodejsFunction(this, "DifferFn", {
      ...common,
      entry: join(HANDLERS, "differ.ts"),
      memorySize: 512,
      timeout: cdk.Duration.minutes(5),
      logGroup: new logs.LogGroup(this, "DifferLogGroup", {
        retention: logs.RetentionDays.TWO_WEEKS,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      }),
      environment: {
        SNAPSHOT_BUCKET: snapshotBucketName,
        DSQL_ENDPOINT: dsqlEndpoint,
      },
    });
    snapshotBucket.grantRead(differFn);
    differFn.addToRolePolicy(dsqlConnect);

    // Ingestor — scheduled poll; on a changed hash, writes a snapshot and
    // asynchronously invokes the differ.
    const ingestorFn = new NodejsFunction(this, "IngestorFn", {
      ...common,
      entry: join(HANDLERS, "ingestor.ts"),
      memorySize: 256,
      timeout: cdk.Duration.minutes(15),
      logGroup: new logs.LogGroup(this, "IngestorLogGroup", {
        retention: logs.RetentionDays.TWO_WEEKS,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      }),
      environment: {
        SNAPSHOT_BUCKET: snapshotBucketName,
        DSQL_ENDPOINT: dsqlEndpoint,
        DIFFER_FUNCTION_NAME: differFn.functionName,
      },
    });
    snapshotBucket.grantWrite(ingestorFn);
    ingestorFn.addToRolePolicy(dsqlConnect);
    differFn.grantInvoke(ingestorFn);

    // Dead-letter queue for failed scheduled invocations.
    const dlq = new sqs.Queue(this, "IngestDlq", {
      retentionPeriod: cdk.Duration.days(14),
      enforceSSL: true,
    });

    // EventBridge Scheduler — daily cron -> ingestor, via a least-privilege
    // role that may only invoke the ingestor (ADR-0010).
    const schedulerRole = new iam.Role(this, "SchedulerInvokeRole", {
      assumedBy: new iam.ServicePrincipal("scheduler.amazonaws.com"),
    });
    ingestorFn.grantInvoke(schedulerRole);
    dlq.grantSendMessages(schedulerRole);

    new scheduler.CfnSchedule(this, "IngestSchedule", {
      flexibleTimeWindow: { mode: "OFF" },
      scheduleExpression: "cron(0 6 * * ? *)",
      scheduleExpressionTimezone: "UTC",
      description: "Daily poll of authoritative sources (ADR-0010).",
      target: {
        arn: ingestorFn.functionArn,
        roleArn: schedulerRole.roleArn,
        deadLetterConfig: { arn: dlq.queueArn },
        retryPolicy: { maximumRetryAttempts: 2 },
      },
    });

    new cdk.CfnOutput(this, "IngestorFunctionName", {
      value: ingestorFn.functionName,
      description: "Ingestor Lambda — the scheduled source poller (ADR-0010).",
    });
    new cdk.CfnOutput(this, "DifferFunctionName", {
      value: differFn.functionName,
      description: "Differ Lambda — runs semdiff on changed content (ADR-0007).",
    });
  }
}
