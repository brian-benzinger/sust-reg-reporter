import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as cdk from "aws-cdk-lib";
import {
  aws_apigatewayv2 as apigw,
  aws_apigatewayv2_integrations as apigwint,
  aws_certificatemanager as acm,
  aws_cloudfront as cloudfront,
  aws_cloudfront_origins as origins,
  aws_iam as iam,
  aws_lambda as lambda,
  aws_logs as logs,
  aws_route53 as route53,
  aws_route53_targets as targets,
  aws_s3 as s3,
  aws_s3_deployment as s3deploy,
  aws_ssm as ssm,
} from "aws-cdk-lib";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import type { Construct } from "constructs";

export interface ServingStackProps extends cdk.StackProps {
  /**
   * When set, serve the site on a custom domain (apex + `www`) over HTTPS using
   * the given us-east-1 certificate, and point Route 53 alias records at the
   * distribution (ADR-0031, ADR-0032). Omitted in tests, where only the
   * generated CloudFront URL is exercised.
   */
  readonly customDomain?: {
    readonly domainName: string;
    readonly certificate: acm.ICertificate;
    readonly hostedZoneId: string;
  };
  /**
   * Override the path to the prerendered web dist directory. Defaults to
   * `web/dist` relative to the repo root. Pass an existing directory in tests
   * to avoid the asset-existence check that fires before `web` is built.
   */
  readonly webDistPath?: string;
}

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

  constructor(scope: Construct, id: string, props: ServingStackProps = {}) {
    super(scope, id, props);

    const customDomain = props.customDomain;
    const webDistPath = props.webDistPath ?? WEB_DIST;

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
    // The immutable snapshot store (ADR-0011), read to slice span-grounding
    // quotes (ADR-0035). Soft-coupled via SSM like the DSQL handles.
    const snapshotBucketName = ssm.StringParameter.valueForStringParameter(
      this,
      "/sust-reg/s3/snapshot-bucket",
    );
    const snapshotBucket = s3.Bucket.fromBucketName(
      this,
      "SnapshotBucket",
      snapshotBucketName,
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
      environment: {
        DSQL_ENDPOINT: dsqlEndpoint,
        DSQL_DB_ROLE: "api_reader",
        SNAPSHOT_BUCKET: snapshotBucketName,
      },
      bundling: { minify: true, externalModules: ["pg-native"] },
    });
    // Read-only on the immutable snapshot store, to slice span-grounding quotes
    // (ADR-0035). The public read path stays SELECT-only on DSQL and read-only
    // on S3 — no write capability anywhere.
    snapshotBucket.grantRead(apiFn);

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

    // www -> apex 301 at the edge (only with a custom domain). A CloudFront
    // Function on the viewer request is cheaper than an S3 redirect bucket and
    // keeps the apex canonical (ADR-0031).
    const wwwRedirect = customDomain
      ? new cloudfront.Function(this, "WwwRedirect", {
          comment: `Redirect www.${customDomain.domainName} -> apex`,
          runtime: cloudfront.FunctionRuntime.JS_2_0,
          code: cloudfront.FunctionCode.fromInline(
            [
              "function handler(event) {",
              "  var request = event.request;",
              "  var host = request.headers.host && request.headers.host.value;",
              `  if (host === 'www.${customDomain.domainName}') {`,
              "    return {",
              "      statusCode: 301,",
              "      statusDescription: 'Moved Permanently',",
              `      headers: { location: { value: 'https://${customDomain.domainName}' + request.uri } },`,
              "    };",
              "  }",
              "  return request;",
              "}",
            ].join("\n"),
          ),
        })
      : undefined;

    const distribution = new cloudfront.Distribution(this, "Distribution", {
      comment: "sust-reg-reporter site + /api/* (ADR-0013, ADR-0023)",
      defaultRootObject: "index.html",
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      // The custom domain + its us-east-1 cert (ADR-0032); absent in tests.
      domainNames: customDomain
        ? [customDomain.domainName, `www.${customDomain.domainName}`]
        : undefined,
      certificate: customDomain?.certificate,
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(webBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        functionAssociations: wwwRedirect
          ? [
              {
                function: wwwRedirect,
                eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
              },
            ]
          : undefined,
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

    // Point the custom domain at the distribution. Apex must be an ALIAS (a
    // CNAME is illegal at the zone apex); www gets the same alias and the
    // function above 301s it to the apex (ADR-0031). The zone is referenced by
    // id — it is owned and RETAINed by the DnsStack.
    if (customDomain) {
      const zone = route53.PublicHostedZone.fromHostedZoneAttributes(
        this,
        "Zone",
        {
          hostedZoneId: customDomain.hostedZoneId,
          zoneName: customDomain.domainName,
        },
      );
      const target = route53.RecordTarget.fromAlias(
        new targets.CloudFrontTarget(distribution),
      );
      new route53.ARecord(this, "ApexAlias", { zone, target });
      new route53.AaaaRecord(this, "ApexAliasAaaa", { zone, target });
      const wwwName = `www.${customDomain.domainName}`;
      new route53.ARecord(this, "WwwAlias", { zone, recordName: wwwName, target });
      new route53.AaaaRecord(this, "WwwAliasAaaa", {
        zone,
        recordName: wwwName,
        target,
      });

      new cdk.CfnOutput(this, "SiteUrl", {
        value: `https://${customDomain.domainName}`,
        description: "Custom-domain URL for the site (ADR-0031).",
      });
    }

    // Publish the prerendered site to the bucket and invalidate CloudFront as
    // part of `cdk deploy` (ADR-0026). `prune` removes objects no longer in the
    // build (like `aws s3 sync --delete`); the helper Lambda gets an explicit
    // 14-day log group so it does not bill silently (ADR-0016).
    new s3deploy.BucketDeployment(this, "DeployWebSite", {
      sources: [s3deploy.Source.asset(webDistPath)],
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
