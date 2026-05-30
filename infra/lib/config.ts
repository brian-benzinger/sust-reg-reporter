import type { Environment } from "aws-cdk-lib";

/**
 * Single-region, single-account configuration (ADR-0016).
 *
 * Account and region come from the ambient CDK environment so nothing is
 * hardcoded into source; the region falls back to a default Aurora DSQL region
 * (ADR-0012). Keeping this in one place lets every stack share one env, which
 * the single-region guard can enforce.
 */

/** Monthly spend ceiling for the budget backstop, in USD (ADR-0016). */
export const BUDGET_LIMIT_USD = 1;

/** Default notification address for the budget alarm (overridable via context). */
export const DEFAULT_BUDGET_EMAIL = "bb42392@gmail.com";

/**
 * The project's single region (ADR-0016) — us-west-2, an Aurora DSQL region
 * (ADR-0012) and the region of the deploying account's SSO profile.
 */
export const DEFAULT_REGION = "us-west-2";

/** Resolve the single CDK deployment environment (account + region). */
export function appEnv(): Environment {
  const region = process.env.CDK_DEPLOY_REGION || DEFAULT_REGION;
  return { account: process.env.CDK_DEFAULT_ACCOUNT, region };
}
