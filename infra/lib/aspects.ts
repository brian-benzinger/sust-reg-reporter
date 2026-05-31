import * as cdk from "aws-cdk-lib";
import { aws_logs as logs } from "aws-cdk-lib";
import type { IAspect } from "aws-cdk-lib";
import type { IConstruct } from "constructs";

/**
 * Cost-discipline guardrails enforced at synth time (ADR-0016, ADR-0014).
 *
 * These aspects make the non-negotiable cost rules impossible to violate by
 * accident: a forbidden resource, an unbounded log group, or a stray region
 * fails `cdk synth`/`deploy` rather than billing silently in production.
 */

/** Resource types that would breach the Always-Free posture. */
const FORBIDDEN: Record<string, string> = {
  "AWS::EC2::NatGateway": "NAT Gateways bill ~$33/mo just to exist",
  "AWS::EC2::VPC":
    "nothing should be VPC-bound; DSQL and S3 are reached over public TLS",
  "AWS::EC2::EIP": "an Elastic IP implies a NAT/VPC egress path",
  "AWS::ApiGateway::RestApi":
    "use the cheaper API Gateway HTTP API, not REST API (ADR-0023)",
  "AWS::ElasticLoadBalancingV2::LoadBalancer":
    "an ALB carries an hourly charge",
};

/** Fail synth if any cost-breaching networking/serving resource appears. */
export class NoCostlyNetworkingAspect implements IAspect {
  visit(node: IConstruct): void {
    if (!cdk.CfnResource.isCfnResource(node)) return;
    const reason = FORBIDDEN[node.cfnResourceType];
    if (reason !== undefined) {
      cdk.Annotations.of(node).addError(
        `Forbidden resource ${node.cfnResourceType}: ${reason} (ADR-0016).`,
      );
    }
  }
}

/** Fail synth if any log group lacks a bounded retention (<= maxDays). */
export class LogRetentionAspect implements IAspect {
  private readonly maxDays: number;

  constructor(maxDays = 14) {
    this.maxDays = maxDays;
  }

  visit(node: IConstruct): void {
    if (!(node instanceof logs.CfnLogGroup)) return;
    const days = node.retentionInDays;
    if (days === undefined || days > this.maxDays) {
      cdk.Annotations.of(node).addError(
        `Log group retention must be set and <= ${this.maxDays} days or it bills silently (ADR-0016); got ${days ?? "INFINITE"}.`,
      );
    }
  }
}

/** Fail synth if any stack targets a region other than the single project region. */
export class SingleRegionAspect implements IAspect {
  private readonly region: string;

  constructor(region: string) {
    this.region = region;
  }

  visit(node: IConstruct): void {
    if (!(node instanceof cdk.Stack)) return;
    const region = node.region;
    if (!cdk.Token.isUnresolved(region) && region !== this.region) {
      cdk.Annotations.of(node).addError(
        `Stack ${node.stackName} targets ${region}, but the project is single-region ${this.region} (ADR-0016).`,
      );
    }
  }
}
