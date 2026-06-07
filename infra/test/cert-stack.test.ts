import { describe, it, expect } from "vitest";
import * as cdk from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { CertStack } from "../lib/cert-stack.ts";

const HZ = "Z0123456789ABCDEFGHIJ";

const templateFor = (domainName = "disclosurelab.dev"): Template => {
  const app = new cdk.App();
  const stack = new CertStack(app, "TestCert", {
    env: { account: "111111111111", region: "us-east-1" },
    domainName,
    hostedZoneId: HZ,
  });
  return Template.fromStack(stack);
};

describe("CertStack — CloudFront viewer cert (ADR-0032)", () => {
  it("issues one DNS-validated cert covering the apex and www", () => {
    const t = templateFor();
    t.resourceCountIs("AWS::CertificateManager::Certificate", 1);
    t.hasResourceProperties("AWS::CertificateManager::Certificate", {
      DomainName: "disclosurelab.dev",
      SubjectAlternativeNames: ["www.disclosurelab.dev"],
      ValidationMethod: "DNS",
    });
  });

  it("validates both names through the given hosted zone (CFN writes the records)", () => {
    templateFor().hasResourceProperties(
      "AWS::CertificateManager::Certificate",
      {
        DomainValidationOptions: Match.arrayWith([
          Match.objectLike({ DomainName: "disclosurelab.dev", HostedZoneId: HZ }),
          Match.objectLike({
            DomainName: "www.disclosurelab.dev",
            HostedZoneId: HZ,
          }),
        ]),
      },
    );
  });

  it("outputs the certificate ARN for cross-region use by the serving stack", () => {
    expect(
      Object.keys(templateFor().findOutputs("CertificateArn")),
    ).toHaveLength(1);
  });
});
