import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as cdk from "aws-cdk-lib";
import {
  aws_apigatewayv2 as apigw,
  aws_apigatewayv2_integrations as apigwint,
  aws_cloudfront as cloudfront,
  aws_cloudfront_origins as origins,
  aws_lambda as lambda,
  aws_logs as logs,
  aws_s3 as s3,
} from "aws-cdk-lib";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import type { Construct } from "constructs";

const API_HANDLER = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "api",
  "src",
  "handler.ts",
);

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
 * The web bucket is private — reachable only through CloudFront. Site content is
 * published with `aws s3 sync` after deploy, kept out of CDK so there is no
 * deployment helper Lambda with an unbounded log group.
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

    // Thin API Lambda (stub router). No Function URL — only API Gateway invokes
    // it (ADR-0023).
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
      bundling: { minify: true },
    });

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

    new cdk.CfnOutput(this, "WebBucketName", {
      value: webBucket.bucketName,
      description: "Private static-site bucket; sync the web build here.",
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
