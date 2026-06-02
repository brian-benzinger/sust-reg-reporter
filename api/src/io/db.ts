import { DsqlSigner } from "@aws-sdk/dsql-signer";
import pg from "pg";

/**
 * Aurora DSQL access from the API Lambda (ADR-0012).
 *
 * Same pattern as the ingest pipeline: connect PER INVOCATION over the cluster's
 * public TLS endpoint with a short-lived IAM auth token — no long-lived pool, no
 * VPC. The endpoint comes from `DSQL_ENDPOINT`; the region from `AWS_REGION`.
 * Duplicated here (rather than imported from `ingest`) so the read-facing API
 * does not depend on the pipeline workspace; it is a few lines of glue and is
 * excluded from the coverage gate.
 *
 * NOTE: connects as the DSQL admin role. The API is the public-facing read path,
 * so a least-privilege read-only DB role is the priority hardening follow-up;
 * until then every query here is parameterized and read-only.
 */
export async function withDsql<T>(
  fn: (client: pg.Client) => Promise<T>,
): Promise<T> {
  const hostname = process.env.DSQL_ENDPOINT;
  if (hostname === undefined || hostname === "") {
    throw new Error("DSQL_ENDPOINT is not set");
  }
  const region =
    process.env.AWS_REGION ?? process.env.CDK_DEPLOY_REGION ?? "us-west-2";
  const signer = new DsqlSigner({ hostname, region });
  const token = await signer.getDbConnectAdminAuthToken();
  const client = new pg.Client({
    host: hostname,
    port: 5432,
    user: "admin",
    password: token,
    database: "postgres",
    ssl: { rejectUnauthorized: true },
  });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}
