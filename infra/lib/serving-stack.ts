import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as cdk from "aws-cdk-lib";
import {
  aws_apigatewayv2 as apigw,
  aws_apigatewayv2_integrations as apigwint,
  aws_cloudfront as cloudfront,
  aws_cloudfront_origins as origins,
  aws_iam as iam,
  aws_lambda as lambda,
  aws_logs as logs,
  aws_s3 as s3,
  aws_s3_deployment as s3deploy,
  aws_ssm as ssm,
} from "aws-cdk-lib";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import type { Construct } from "constructs";

const HERE = dirname(fileURLToPath(import.meta.url));
const API_HANDLER = join(HERE, "..", "..", "api", "src", "handlers", "api.ts");
// The prerendered static site (`npm run build -w web` → web/dist). Must be built
// before `cdk synth`/`deploy`, since BucketDeployment stages it as an asset.
const WEB_DIST = join(HERE, "..", "..", "web", "dist");

/**
 * Serving layer (ADR-0013, ADR-0023): a single CloudFront distribution fronting
 * both the statically generated web site (default behavior, private S3 via OAC)
 * and the thin interactive API (`/api/*`).
 *
 * The API is an API Gateway HTTP API integrated to the API Lambda: the Lambda is
 * never publicly exposed (only API Gateway may invoke it), and the HTTP API's
 * default stage is throttled so the public endpoint cannot run up cost
 * (ADR-0023, ADR-0016). Reads are served statically; the API is reserved for the
 * three interactive features.
 *
 * The web bucket is private — reachable only through CloudFront. The prerendered
 * site (web/dist) is published as part of `cdk deploy` via a BucketDeployment,
 * which also invalidates the CloudFront cache; its helper Lambda is given an
 * explicit 14-day log group so the deploy stays inside the cost envelope
 * (ADR-0016, ADR-0026).
 */
export class ServingStack extends cdk.Stack {
  readonly webBucket: s3.IBucket;
  readonly distributionDomainName: string;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const webBucket = new s3.Bucket(this, "WebBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });
    this.webBucket = webBucket;

    // DSQL corpus handles from the DataStack, consumed via SSM (soft coupling,
    // same as the pipeline) so serving can be torn down without touching data.
    const dsqlEndpoint = ssm.StringParameter.valueForStringParameter(
      this,
      "/sust-reg/dsql/endpoint",
    );
    const dsqlClusterArn = ssm.StringParameter.valueForStringParameter(
      this,
      "/sust-reg/dsql/cluster-arn",
    );

    // Thin API Lambda — reads the DSQL corpus (ADR-0012). No Function URL: only
    // API Gateway invokes it (ADR-0023). Bundle @aws-sdk/dsql-signer + pg (the
    // runtime lacks the signer); pg's optional native addon stays external.
    const apiFn = new NodejsFunction(this, "ApiFn", {
      entry: API_HANDLER,
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      memorySize: 256,
      timeout: cdk.Duration.seconds(10),
      logGroup: new logs.LogGroup(this, "ApiLogGroup", {
        retention: logs.RetentionDays.TWO_WEEKS,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      }),
      environment: { DSQL_ENDPOINT: dsqlEndpoint, DSQL_DB_ROLE: "api_reader" },
      bundling: { minify: true, externalModules: ["pg-native"] },
    });

    // The API connects as the least-privilege, SELECT-only `api_reader` database
    // role (provisioned via the admin ingestor's dbGrants path and mapped to this
    // Lambda's role with `AWS IAM GRANT`). Only `dsql:DbConnect` — never the admin
    // action — so this public-facing read path has no write capability (ADR-0012).
    apiFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["dsql:DbConnect"],
        resources: [dsqlClusterArn],
      }),
    );

    // API Gateway HTTP API -> Lambda, with a throttled default stage so the
    // public endpoint cannot run up cost (ADR-0023, ADR-0016).
    const httpApi = new apigw.HttpApi(this, "HttpApi", {
      apiName: "sust-reg-api",
      createDefaultStage: false,
      defaultIntegration: new apigwint.HttpLambdaIntegration(
        "ApiIntegration",
        apiFn,
      ),
    });
    new apigw.HttpStage(this, "DefaultStage", {
      httpApi,
      stageName: "$default",
      autoDeploy: true,
      throttle: { rateLimit: 50, burstLimit: 100 },
    });
    const apiDomain = `${httpApi.apiId}.execute-api.${this.region}.amazonaws.com`;

    const distribution = new cloudfront.Distribution(this, "Distribution", {
      comment: "sust-reg-reporter site + /api/* (ADR-0013, ADR-0023)",
      defaultRootObject: "index.html",
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(webBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      additionalBehaviors: {
        // The thin API: never cached, all methods, and no viewer Host header to
        // the API Gateway origin (which validates Host against its own domain).
        "/api/*": {
          origin: new origins.HttpOrigin(apiDomain),
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy:
            cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        },
      },
    });
    this.distributionDomainName = distribution.distributionDomainName;

    // Publish the prerendered site to the bucket and invalidate CloudFront as
    // part of `cdk deploy` (ADR-0026). `prune` removes objects no longer in the
    // build (like `aws s3 sync --delete`); the helper Lambda gets an explicit
    // 14-day log group so it does not bill silently (ADR-0016).
    new s3deploy.BucketDeployment(this, "DeployWebSite", {
      sources: [s3deploy.Source.asset(WEB_DIST)],
      destinationBucket: webBucket,
      distribution,
      distributionPaths: ["/*"],
      prune: true,
      logGroup: new logs.LogGroup(this, "WebDeployLogGroup", {
        retention: logs.RetentionDays.TWO_WEEKS,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      }),
    });

    new cdk.CfnOutput(this, "WebBucketName", {
      value: webBucket.bucketName,
      description: "Private static-site bucket; published by BucketDeployment.",
    });
    new cdk.CfnOutput(this, "ApiEndpoint", {
      value: httpApi.apiEndpoint,
      description: "API Gateway HTTP API endpoint (throttled) — ADR-0023.",
    });
    new cdk.CfnOutput(this, "DistributionUrl", {
      value: `https://${distribution.distributionDomainName}`,
      description: "CloudFront URL serving the site and /api/* (ADR-0013).",
    });
  }
}
