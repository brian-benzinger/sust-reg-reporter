import * as cdk from "aws-cdk-lib";
import { CertStack } from "../lib/cert-stack.ts";
import { CostStack } from "../lib/cost-stack.ts";
import { DataStack } from "../lib/data-stack.ts";
import { DnsStack } from "../lib/dns-stack.ts";
import { PipelineStack } from "../lib/pipeline-stack.ts";
import { ServingStack } from "../lib/serving-stack.ts";
import {
  LogRetentionAspect,
  NoCostlyNetworkingAspect,
  SingleRegionAspect,
} from "../lib/aspects.ts";
import {
  appEnv,
  CUSTOM_DOMAIN,
  DEFAULT_REGION,
  HOSTED_ZONE_ID,
} from "../lib/config.ts";

/** The lone stack allowed outside the project region — a us-east-1 CloudFront cert (ADR-0032). */
const CERT_STACK_ID = "SustReg-CertUsEast1";

const app = new cdk.App();
const env = appEnv();

// The budget-alert email is supplied at deploy time — `SUSTREG_BUDGET_EMAIL` or
// `-c budgetEmail=...` — never hardcoded, so no personal address lives in the
// repo. CostStack rejects a missing or placeholder address (ADR-0016).
const budgetEmail =
  process.env.SUSTREG_BUDGET_EMAIL ??
  (app.node.tryGetContext("budgetEmail") as string | undefined) ??
  "";

// Where pipeline health alarms email (ADR-0033). Defaults to the budget inbox so
// a single operator address covers both cost and health; override to split them.
const alertEmail =
  process.env.SUSTREG_ALERT_EMAIL ??
  (app.node.tryGetContext("alertEmail") as string | undefined) ??
  budgetEmail;

// Deployed FIRST and standalone so the cost guardrail exists before — and
// outlives — any billable resource (ADR-0016).
new CostStack(app, "SustReg-Cost", {
  env,
  budgetEmail,
  description:
    "sust-reg-reporter cost backstop: $1 monthly budget alarm, deployed first and standalone (ADR-0016).",
});

// Stateful, RETAIN data layer (ADR-0011): the immutable content-addressed
// snapshot store. (Aurora DSQL is added in a following PR.)
new DataStack(app, "SustReg-Data", {
  env,
  description:
    "sust-reg-reporter content-addressed immutable snapshot store (ADR-0011); Aurora DSQL added next.",
});

// Ingest pipeline (ADR-0010): scheduled ingestor + differ Lambdas. Stateless;
// consumes the DataStack handles (bucket, DSQL) via SSM.
new PipelineStack(app, "SustReg-Pipeline", {
  env,
  alertEmail,
  description:
    "sust-reg-reporter ingest pipeline: EventBridge-scheduled ingestor + differ Lambdas (ADR-0010).",
});

// Authoritative DNS for the custom domain (ADR-0031). Registered at Vercel,
// nameservers delegated to this RETAINed hosted zone. Foundational and rarely
// touched; the cert and the serving alias records reference it by id.
new DnsStack(app, "SustReg-Dns", {
  env,
  domainName: CUSTOM_DOMAIN,
  description:
    "sust-reg-reporter authoritative DNS: Route 53 public hosted zone for the custom domain, registered at Vercel and delegated here (ADR-0031).",
});

// CloudFront viewer certificate (ADR-0032). Pinned to us-east-1 (CloudFront's
// only accepted cert region) — the lone, narrowly-allowed exception to the
// single-region guard below. DNS-validated against the zone above; consumed
// cross-region by the serving stack, so both sides set crossRegionReferences.
const certStack = new CertStack(app, CERT_STACK_ID, {
  env: { account: env.account, region: "us-east-1" },
  crossRegionReferences: true,
  domainName: CUSTOM_DOMAIN,
  hostedZoneId: HOSTED_ZONE_ID,
  description:
    "sust-reg-reporter CloudFront viewer certificate (us-east-1) for the custom domain, DNS-validated via Route 53 (ADR-0032).",
});

// Serving layer (ADR-0013, ADR-0023): one CloudFront fronting the static web
// site and the thin API (/api/*). Served on the custom domain (apex + www) over
// HTTPS using the us-east-1 cert above (cross-region reference) with Route 53
// alias records and a www->apex redirect (ADR-0031, ADR-0032).
new ServingStack(app, "SustReg-Serving", {
  env,
  crossRegionReferences: true,
  customDomain: {
    domainName: CUSTOM_DOMAIN,
    certificate: certStack.certificate,
    hostedZoneId: HOSTED_ZONE_ID,
  },
  description:
    "sust-reg-reporter serving layer: CloudFront (custom domain) + private web bucket + thin API HTTP API (ADR-0013, ADR-0023, ADR-0031).",
});

// Cost-discipline guardrails, enforced at synth time (ADR-0016, ADR-0014).
cdk.Aspects.of(app).add(new NoCostlyNetworkingAspect());
cdk.Aspects.of(app).add(new LogRetentionAspect(14));
cdk.Aspects.of(app).add(
  new SingleRegionAspect(DEFAULT_REGION, [CERT_STACK_ID]),
);

cdk.Tags.of(app).add("project", "sust-reg-reporter");

app.synth();
