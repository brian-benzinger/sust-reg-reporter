import { describe, it, expect } from "vitest";
import * as cdk from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { DnsStack } from "../lib/dns-stack.ts";

const templateFor = (domainName = "example-test.dev"): Template => {
  const app = new cdk.App();
  const stack = new DnsStack(app, "TestDns", { domainName });
  return Template.fromStack(stack);
};

describe("DnsStack — authoritative DNS for the custom domain (ADR-0031)", () => {
  it("creates exactly one public hosted zone for the domain", () => {
    const t = templateFor("disclosurelab.dev");
    t.resourceCountIs("AWS::Route53::HostedZone", 1);
    t.hasResourceProperties("AWS::Route53::HostedZone", {
      Name: "disclosurelab.dev.",
    });
  });

  it("RETAINs the zone so a teardown can never rotate its nameservers", () => {
    // The nameservers are pasted into the Vercel registrar by hand; a recreate
    // would rotate them and break the delegation (ADR-0031).
    templateFor().hasResource("AWS::Route53::HostedZone", {
      DeletionPolicy: "Retain",
      UpdateReplacePolicy: "Retain",
    });
  });

  it("outputs the zone id and the nameservers to delegate at the registrar", () => {
    const t = templateFor();
    expect(Object.keys(t.findOutputs("HostedZoneId"))).toHaveLength(1);
    expect(Object.keys(t.findOutputs("NameServers"))).toHaveLength(1);
  });
});
