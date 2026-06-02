import { DsqlSigner } from "@aws-sdk/dsql-signer";
import pg from "pg";

/**
 * Aurora DSQL access from the API Lambda (ADR-0012).
 *
 * Same connect-per-invocation pattern as the ingest pipeline — public TLS
 * endpoint, short-lived IAM auth token, no pool, no VPC — but the public-facing
 * API connects as a least-privilege, SELECT-only database role (`DSQL_DB_ROLE`,
 * default `api_reader`) mapped to this Lambda's IAM role. It uses the non-admin
 * `dsql:DbConnect` token (`getDbConnectAuthToken`); it has no write capability,
 * so a SQL bug or injection cannot mutate the corpus. Duplicated from `ingest`
 * (rather than imported) so the read API does not depend on the pipeline; it is
 * a few lines of glue and is excluded from the coverage gate.
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
  const user = process.env.DSQL_DB_ROLE ?? "api_reader";
  const signer = new DsqlSigner({ hostname, region });
  const token = await signer.getDbConnectAuthToken();
  const client = new pg.Client({
    host: hostname,
    port: 5432,
    user,
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
