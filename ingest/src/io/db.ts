import { DsqlSigner } from "@aws-sdk/dsql-signer";
import pg from "pg";

/**
 * Aurora DSQL access from Lambda (ADR-0012).
 *
 * Connect PER INVOCATION over the cluster's public TLS endpoint with a
 * short-lived IAM auth token — no long-lived TCP pool (connection exhaustion),
 * no VPC. The endpoint comes from `DSQL_ENDPOINT`; the region from the Lambda's
 * `AWS_REGION`. DSQL speaks the PostgreSQL wire protocol, so a standard `pg`
 * client works once the token is used as the password.
 */

function endpoint(): string {
  const e = process.env.DSQL_ENDPOINT;
  if (e === undefined || e === "") throw new Error("DSQL_ENDPOINT is not set");
  return e;
}

function region(): string {
  return process.env.AWS_REGION ?? process.env.CDK_DEPLOY_REGION ?? "us-west-2";
}

/** Open a DSQL connection, run `fn`, and always close it. */
export async function withDsql<T>(
  fn: (client: pg.Client) => Promise<T>,
): Promise<T> {
  const hostname = endpoint();
  const signer = new DsqlSigner({ hostname, region: region() });
  // Connect as the DSQL admin role for now; a least-privilege DB role mapped to
  // the Lambda's IAM role is a follow-up hardening.
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

/** Health check: confirm the caller can reach DSQL and run a query. */
export async function ping(): Promise<{ ok: true; server: string }> {
  return withDsql(async (client) => {
    const r = await client.query<{ v: string }>("select version() as v");
    return { ok: true, server: r.rows[0]?.v ?? "unknown" };
  });
}
