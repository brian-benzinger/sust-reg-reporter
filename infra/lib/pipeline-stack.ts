import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as cdk from "aws-cdk-lib";
import {
  aws_cloudwatch as cw,
  aws_cloudwatch_actions as cwActions,
  aws_iam as iam,
  aws_lambda as lambda,
  aws_logs as logs,
  aws_s3 as s3,
  aws_scheduler as scheduler,
  aws_sns as sns,
  aws_sns_subscriptions as subscriptions,
  aws_sqs as sqs,
  aws_ssm as ssm,
} from "aws-cdk-lib";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import type { Construct } from "constructs";
import { assertValidEmail } from "./email.ts";

export interface PipelineStackProps extends cdk.StackProps {
  /**
   * Verified email that pipeline health alarms notify (ADR-0033). Defaults to
   * the budget-alert inbox at the app level; required here so the stack never
   * synthesizes an alarm topic that emails nobody.
   */
  readonly alertEmail: string;
}

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
  constructor(scope: Construct, id: string, props: PipelineStackProps) {
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
    // DbConnectAdmin lets the pipeline connect as the DSQL admin role for now; a
    // least-privilege DB role mapped to the Lambda is a follow-up hardening.
    const dsqlConnect = new iam.PolicyStatement({
      actions: ["dsql:DbConnect", "dsql:DbConnectAdmin"],
      resources: [dsqlClusterArn],
    });

    // SSM SecureString holding the Anthropic API key for semdiff (ADR-0024).
    // Created out of band — its value is never in git or the template; the
    // differ reads and decrypts it at cold start.
    const anthropicKeyParam = "/sust-reg/anthropic-api-key";

    // No reservedConcurrentExecutions: a new account's concurrency floor (the
    // unreserved pool must stay >= 10) rejects reserving any. Idempotency comes
    // from the content-hash gate and idempotency keys (ADR-0007, ADR-0011), not
    // from serialized concurrency.
    const common = {
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      handler: "handler",
      // Bundle dependencies (semdiff, pg, @aws-sdk/dsql-signer + client-ssm):
      // the pipeline needs @aws-sdk/dsql-signer, which the Lambda runtime does
      // NOT provide, so we can't externalize @aws-sdk wholesale. pg's optional
      // native addon stays external (unused — pg falls back to pure JS).
      bundling: { minify: true, externalModules: ["pg-native"] },
    };

    // Differ — runs semdiff on a changed snapshot (gated by the ingestor).
    const differFn = new NodejsFunction(this, "DifferFn", {
      ...common,
      entry: join(HANDLERS, "differ.ts"),
      // semdiff loads both full snapshots and builds the structured diff in
      // memory; 512 MB OOMs on real legal documents (only the tiny demo fit).
      // More memory also raises the CPU share, so the diff finishes faster.
      memorySize: 1536,
      // semdiff >=0.1.2 classifies changed pairs concurrently (bounded pool), so
      // a real legal-document diff is fast: the CSRD Omnibus diff (~58 changes)
      // runs in ~19s. The wall fits a cap-sized diff (MAX_CLASSIFIED_CHANGES, see
      // diff.ts) with margin while still failing fast on a runaway. Runaway cost
      // is bounded by the change-set cap and retryAttempts:0, not by the wall
      // (ADR-0016).
      timeout: cdk.Duration.seconds(90),
      // Async-invoked by the ingestor. Do NOT retry: the LLM classification is
      // not idempotent in cost — a timed-out/failed diff that retried twice
      // re-billed the whole classification each time (ADR-0016). A genuinely
      // needed diff can be re-requested via the `rediff` maintenance op.
      retryAttempts: 0,
      logGroup: new logs.LogGroup(this, "DifferLogGroup", {
        retention: logs.RetentionDays.TWO_WEEKS,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      }),
      environment: {
        SNAPSHOT_BUCKET: snapshotBucketName,
        DSQL_ENDPOINT: dsqlEndpoint,
        ANTHROPIC_KEY_PARAM: anthropicKeyParam,
      },
    });
    snapshotBucket.grantRead(differFn);
    differFn.addToRolePolicy(dsqlConnect);

    // The differ reads the Anthropic key from SSM at cold start (ADR-0024):
    // GetParameter on that one parameter + KMS decrypt scoped to SSM. The key is
    // granted ONLY to the differ; nothing public can reach this Lambda.
    differFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["ssm:GetParameter"],
        resources: [
          `arn:aws:ssm:${this.region}:${this.account}:parameter${anthropicKeyParam}`,
        ],
      }),
    );
    differFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["kms:Decrypt"],
        resources: ["*"],
        conditions: {
          StringEquals: { "kms:ViaService": `ssm.${this.region}.amazonaws.com` },
        },
      }),
    );

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

    // --- Observability: health alarms + alert fan-out + dashboard (ADR-0033) ---
    // The daily poll is otherwise invisible: a silently disabled schedule, a
    // source that starts 403ing, or a dead-lettered run would go unnoticed until
    // someone happened to look. These alarms make the pipeline's health legible
    // and route a human a message when it breaks. The $1 budget alarm (ADR-0016)
    // stays a COST backstop — it says nothing about whether the pipeline ran.
    // All Always-Free: <10 alarms, 1 SNS topic, 1 of the 3 free dashboards.
    const alertEmail = assertValidEmail(props.alertEmail, "alertEmail");

    const alerts = new sns.Topic(this, "PipelineAlerts", {
      displayName: "sust-reg pipeline health alerts",
    });
    alerts.addSubscription(new subscriptions.EmailSubscription(alertEmail));
    const notify = new cwActions.SnsAction(alerts);

    // The cron fires daily, so a one-day window is the natural evaluation period.
    const day = cdk.Duration.days(1);

    // "Did the daily poll run at all?" — the direct, alarm-backed answer to "is
    // the backend running daily". No invocation in the window => missing data =>
    // BREACHING, so a disabled schedule or a broken trigger pages someone.
    const notRunning = new cw.Alarm(this, "IngestorNotRunningAlarm", {
      alarmDescription:
        "Ingestor has not run in the last day — the daily poll is broken or the EventBridge schedule was disabled (ADR-0010).",
      metric: ingestorFn.metricInvocations({ period: day, statistic: "Sum" }),
      threshold: 1,
      comparisonOperator: cw.ComparisonOperator.LESS_THAN_THRESHOLD,
      evaluationPeriods: 1,
      treatMissingData: cw.TreatMissingData.BREACHING,
    });

    const ingestorErrors = new cw.Alarm(this, "IngestorErrorsAlarm", {
      alarmDescription:
        "The scheduled ingestor invocation errored (ADR-0010).",
      metric: ingestorFn.metricErrors({ period: day, statistic: "Sum" }),
      threshold: 1,
      comparisonOperator: cw.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      evaluationPeriods: 1,
      treatMissingData: cw.TreatMissingData.NOT_BREACHING,
    });

    const differErrors = new cw.Alarm(this, "DifferErrorsAlarm", {
      alarmDescription:
        "The differ errored — a needed semdiff run may be missing; re-request it via the rediff op (ADR-0007).",
      metric: differFn.metricErrors({ period: day, statistic: "Sum" }),
      threshold: 1,
      comparisonOperator: cw.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      evaluationPeriods: 1,
      treatMissingData: cw.TreatMissingData.NOT_BREACHING,
    });

    // A message in the DLQ means a scheduled invoke exhausted its retries.
    const dlqNotEmpty = new cw.Alarm(this, "IngestDlqAlarm", {
      alarmDescription:
        "A scheduled ingest was dead-lettered after exhausting its retries (ADR-0010).",
      metric: dlq.metricApproximateNumberOfMessagesVisible({
        period: cdk.Duration.minutes(5),
        statistic: "Maximum",
      }),
      threshold: 1,
      comparisonOperator: cw.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      evaluationPeriods: 1,
      treatMissingData: cw.TreatMissingData.NOT_BREACHING,
    });

    const healthAlarms = [
      notRunning,
      ingestorErrors,
      differErrors,
      dlqNotEmpty,
    ];
    for (const alarm of healthAlarms) {
      alarm.addAlarmAction(notify);
      alarm.addOkAction(notify); // also notify on recovery, so "resolved" is explicit
    }

    // One at-a-glance dashboard (CloudWatch's first 3 dashboards are free,
    // ADR-0016); the default window matches the 14-day log retention.
    const dashboard = new cw.Dashboard(this, "PipelineDashboard", {
      dashboardName: "SustReg-Pipeline",
      defaultInterval: cdk.Duration.days(14),
    });
    dashboard.addWidgets(
      new cw.AlarmStatusWidget({
        title: "Pipeline health",
        width: 24,
        alarms: healthAlarms,
      }),
    );
    dashboard.addWidgets(
      new cw.GraphWidget({
        title: "Ingestor — invocations & errors (daily)",
        width: 12,
        left: [ingestorFn.metricInvocations({ period: day, statistic: "Sum" })],
        right: [ingestorFn.metricErrors({ period: day, statistic: "Sum" })],
      }),
      new cw.GraphWidget({
        title: "Ingestor — duration",
        width: 12,
        left: [
          ingestorFn.metricDuration({ statistic: "p50" }),
          ingestorFn.metricDuration({ statistic: "p99" }),
        ],
      }),
    );
    dashboard.addWidgets(
      new cw.GraphWidget({
        title: "Differ — invocations & errors (daily)",
        width: 12,
        left: [differFn.metricInvocations({ period: day, statistic: "Sum" })],
        right: [differFn.metricErrors({ period: day, statistic: "Sum" })],
      }),
      new cw.GraphWidget({
        title: "Ingest DLQ — visible messages",
        width: 12,
        left: [
          dlq.metricApproximateNumberOfMessagesVisible({
            period: cdk.Duration.minutes(5),
            statistic: "Maximum",
          }),
        ],
      }),
    );

    new cdk.CfnOutput(this, "IngestorFunctionName", {
      value: ingestorFn.functionName,
      description: "Ingestor Lambda — the scheduled source poller (ADR-0010).",
    });
    new cdk.CfnOutput(this, "DifferFunctionName", {
      value: differFn.functionName,
      description: "Differ Lambda — runs semdiff on changed content (ADR-0007).",
    });
    new cdk.CfnOutput(this, "AlertTopicArn", {
      value: alerts.topicArn,
      description: "SNS topic that pipeline health alarms notify (ADR-0033).",
    });
    new cdk.CfnOutput(this, "DashboardName", {
      value: dashboard.dashboardName,
      description: "CloudWatch pipeline-health dashboard (ADR-0033).",
    });
  }
}
