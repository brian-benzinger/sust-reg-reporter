import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as cdk from "aws-cdk-lib";
import {
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
 * Serving layer (ADR-0013, ADR-0014): a single CloudFront distribution fronting
 * both the statically generated web site (default behavior, S3 origin via OAC)
 * and the thin interactive API (`/api/*`, a Lambda Function URL origin via OAC
 * SigV4). CloudFront egress is Always-Free; reads are served statically and the
 * API is reserved for the three interactive features (ADR-0016).
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

    // Thin API Lambda (stub router) behind a Function URL, IAM-authed so only
    // CloudFront (via OAC SigV4) can reach it.
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
    const apiUrl = apiFn.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.AWS_IAM,
      invokeMode: lambda.InvokeMode.BUFFERED,
    });

    const distribution = new cloudfront.Distribution(this, "Distribution", {
      comment: "sust-reg-reporter site + /api/* (ADR-0013, ADR-0014)",
      defaultRootObject: "index.html",
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(webBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      additionalBehaviors: {
        // The thin API: never cached, all methods, no host header to the
        // Function URL origin (required for Function URL OAC).
        "/api/*": {
          origin: origins.FunctionUrlOrigin.withOriginAccessControl(apiUrl),
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
    new cdk.CfnOutput(this, "DistributionUrl", {
      value: `https://${distribution.distributionDomainName}`,
      description: "CloudFront URL serving the site and /api/* (ADR-0013).",
    });
  }
}
