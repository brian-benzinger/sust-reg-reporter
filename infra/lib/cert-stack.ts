import * as cdk from "aws-cdk-lib";
import {
  aws_certificatemanager as acm,
  aws_route53 as route53,
} from "aws-cdk-lib";
import type { Construct } from "constructs";

export interface CertStackProps extends cdk.StackProps {
  /** Apex domain the cert is issued for; it also covers `www.<domainName>`. */
  readonly domainName: string;
  /** Id of the Route 53 hosted zone used for DNS validation (ADR-0031). */
  readonly hostedZoneId: string;
}

/**
 * CloudFront viewer certificate for the custom domain (ADR-0032).
 *
 * CloudFront only accepts ACM certificates in **us-east-1**, so this stack is
 * pinned there — the one deliberate exception to the single-region guard
 * (ADR-0016), granted narrowly through `SingleRegionAspect`'s exemption list so
 * the guard still fails any *other* stray region.
 *
 * The cert covers the apex and `www`, DNS-validated against the Route 53 zone
 * (ADR-0031). Because the validation options carry the hosted zone id,
 * CloudFormation writes — and later cleans up — the validation records itself;
 * no custom resource. The issued cert is consumed cross-region by the serving
 * stack, which attaches it to the CloudFront distribution.
 */
export class CertStack extends cdk.Stack {
  /** The issued ACM certificate (us-east-1), for the serving stack to attach. */
  readonly certificate: acm.ICertificate;

  constructor(scope: Construct, id: string, props: CertStackProps) {
    super(scope, id, props);

    const zone = route53.PublicHostedZone.fromHostedZoneAttributes(
      this,
      "Zone",
      { hostedZoneId: props.hostedZoneId, zoneName: props.domainName },
    );

    this.certificate = new acm.Certificate(this, "SiteCert", {
      domainName: props.domainName,
      subjectAlternativeNames: [`www.${props.domainName}`],
      validation: acm.CertificateValidation.fromDns(zone),
    });

    new cdk.CfnOutput(this, "CertificateArn", {
      value: this.certificate.certificateArn,
      description:
        "ACM cert ARN (us-east-1) for the CloudFront custom domain (ADR-0032).",
    });
  }
}
