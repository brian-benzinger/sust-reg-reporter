import * as cdk from "aws-cdk-lib";
import { aws_route53 as route53 } from "aws-cdk-lib";
import type { Construct } from "constructs";

export interface DnsStackProps extends cdk.StackProps {
  /** The apex domain to host authoritative DNS for (e.g. disclosurelab.dev). */
  readonly domainName: string;
}

/**
 * Authoritative DNS for the custom domain (ADR-0031).
 *
 * The domain is *registered* at Vercel — one registrar so renewals are tracked
 * in a single place — but its nameservers are delegated to this Route 53 public
 * hosted zone, which is the authoritative DNS host. Keeping DNS in Route 53 lets
 * sibling stacks wire an apex alias to CloudFront and validate an ACM
 * certificate by DNS, neither of which Vercel DNS does cleanly for an apex on
 * CloudFront.
 *
 * The zone is a foundational, externally-referenced resource: its four
 * nameservers are pasted into Vercel by hand, so a destroy/recreate would
 * silently rotate them and break the delegation — taking the domain offline. It
 * is therefore RETAINed and lives alone in this rarely-touched stack; the
 * volatile records inside it (ACM validation, the CloudFront alias) are managed
 * by their own stacks, which reference this zone by id. CDK owns the single
 * canonical zone; its nameservers are read from the `NameServers` stack output
 * and delegated at Vercel.
 */
export class DnsStack extends cdk.Stack {
  /** The public hosted zone, exposed for sibling stacks to reference by id. */
  public readonly zone: route53.PublicHostedZone;

  constructor(scope: Construct, id: string, props: DnsStackProps) {
    super(scope, id, props);

    this.zone = new route53.PublicHostedZone(this, "HostedZone", {
      zoneName: props.domainName,
      comment: `DNS for ${props.domainName} - registered at Vercel - delegated to Route53 for CloudFront/ACM (sust-reg-reporter)`,
    });

    // The zone's identity is wired into the registrar by hand (its nameservers
    // are pasted into Vercel). RETAIN so a stack teardown can never rotate the
    // nameservers out from under the registrar and take the domain offline
    // (ADR-0031).
    (this.zone.node.defaultChild as route53.CfnHostedZone).applyRemovalPolicy(
      cdk.RemovalPolicy.RETAIN,
    );

    new cdk.CfnOutput(this, "HostedZoneId", {
      value: this.zone.hostedZoneId,
      description: "Route 53 hosted zone id for the custom domain (ADR-0031).",
    });

    new cdk.CfnOutput(this, "NameServers", {
      // The four authoritative nameservers to delegate to at the Vercel registrar.
      value: cdk.Fn.join(", ", this.zone.hostedZoneNameServers as string[]),
      description:
        "Nameservers to set at the Vercel registrar to delegate DNS to Route 53 (ADR-0031).",
    });
  }
}
