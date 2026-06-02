import { describe, it, expect } from "vitest";
import type pg from "pg";
import { ensureReaderRole } from "../src/io/schema.ts";

/** Minimal pg.Client fake: records SQL and answers the two existence probes. */
function fakeClient(opts: { roleExists?: boolean; mappingExists?: boolean }) {
  const sql: string[] = [];
  const client = {
    query: async (text: string) => {
      sql.push(text);
      if (text.includes("from pg_roles")) {
        return { rowCount: opts.roleExists ? 1 : 0, rows: [] };
      }
      if (text.includes("sys.iam_pg_role_mappings")) {
        return { rowCount: opts.mappingExists ? 1 : 0, rows: [] };
      }
      return { rowCount: 0, rows: [] };
    },
  } as unknown as pg.Client;
  return { client, sql };
}

const ARN = "arn:aws:iam::111111111111:role/SustReg-Serving-ApiFnRole-ABC123";

describe("ensureReaderRole (ADR-0012) — least-privilege provisioning", () => {
  it("creates the role, maps the IAM ARN, and grants SELECT on each table", async () => {
    const { client, sql } = fakeClient({});
    const r = await ensureReaderRole(client, {
      role: "api_reader",
      iamRoleArn: ARN,
      tables: ["sources", "diffs"],
    });
    expect(r).toEqual({ role: "api_reader", created: true, mapped: true });
    expect(sql).toContain("create role api_reader with login");
    expect(sql).toContain(`AWS IAM GRANT api_reader TO '${ARN}'`);
    expect(sql).toContain("grant select on sources to api_reader");
    expect(sql).toContain("grant select on diffs to api_reader");
    // Read-only: never an INSERT/UPDATE/DELETE/ALL grant.
    expect(sql.some((s) => /grant\s+(insert|update|delete|all)/i.test(s))).toBe(
      false,
    );
  });

  it("is idempotent: skips CREATE ROLE and the mapping when both exist", async () => {
    const { client, sql } = fakeClient({ roleExists: true, mappingExists: true });
    const r = await ensureReaderRole(client, { role: "api_reader", iamRoleArn: ARN });
    expect(r).toEqual({ role: "api_reader", created: false, mapped: false });
    expect(sql.some((s) => s.startsWith("create role"))).toBe(false);
    expect(sql.some((s) => s.startsWith("AWS IAM GRANT"))).toBe(false);
    // Grants still re-applied (naturally idempotent).
    expect(sql).toContain("grant select on sources to api_reader");
  });

  it("rejects injection via the role name, IAM ARN, or table names", async () => {
    const { client } = fakeClient({});
    await expect(
      ensureReaderRole(client, { role: "api_reader; drop table diffs", iamRoleArn: ARN }),
    ).rejects.toThrow(/invalid role/);
    await expect(
      ensureReaderRole(client, { role: "api_reader", iamRoleArn: "not-an-arn" }),
    ).rejects.toThrow(/invalid IAM role ARN/);
    await expect(
      ensureReaderRole(client, {
        role: "api_reader",
        iamRoleArn: ARN,
        tables: ["sources; drop table diffs"],
      }),
    ).rejects.toThrow(/invalid table/);
  });
});
