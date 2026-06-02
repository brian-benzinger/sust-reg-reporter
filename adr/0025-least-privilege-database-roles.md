# 0025 — Least-privilege database roles for the serving path

- **Status:** Accepted
- **Date:** 2026-06-01

## Context

Aurora DSQL authenticates connections with IAM (ADR-0012). The simplest path —
and what the pipeline started with — is to connect as the built-in `admin`
database role using the `dsql:DbConnectAdmin` IAM action and an admin auth token.
`admin` is effectively superuser: full read/write/DDL on the whole database.

That is acceptable for the **ingest pipeline**, which legitimately writes
snapshots, versions, and diffs and provisions schema. It is **not** acceptable
for the **API** (ADR-0013): the API is the public-facing surface (reachable via
CloudFront → API Gateway), it only ever reads, and a SQL bug or injection on a
connection holding write/DDL privileges could corrupt or destroy the immutable,
bitemporal corpus (ADR-0003, ADR-0011). Parameterized queries reduce the risk but
do not bound the blast radius; least privilege does.

## Decision

The API connects as a dedicated, **read-only** DSQL database role
(`api_reader`), never as `admin`.

DSQL maps IAM identities to database roles. We provision the role as `admin`,
once, and the mapping is idempotent and codified (the admin ingestor's `dbGrants`
path, alongside `dbInit`):

```sql
CREATE ROLE api_reader WITH LOGIN;
AWS IAM GRANT api_reader TO '<api-lambda-execution-role-arn>';
GRANT SELECT ON sources, source_versions, diffs TO api_reader;
```

The API Lambda is then granted only the non-admin **`dsql:DbConnect`** IAM action
(never `dsql:DbConnectAdmin`), connects with the non-admin auth token
(`getDbConnectAuthToken`), and uses `api_reader` as the PostgreSQL user. Database
authorization — not just IAM — caps it at `SELECT` on the three corpus tables.

`GRANT USAGE ON SCHEMA public` is intentionally omitted: DSQL rejects it
("feature not supported on system entity") and it is unnecessary, since the
`PUBLIC` pseudo-role already holds `USAGE` on the public schema by default.

## Consequences

- The public read path has **no write capability**: the worst a compromised or
  buggy API connection can do is read public corpus data it already serves.
- IAM and database authorization are defense-in-depth: the IAM role can only
  `DbConnect`, and the database role can only `SELECT`.
- Adding a table the API must read requires extending the `dbGrants` grant list
  and re-running it (idempotent) — a deliberate, auditable step.
- The role-to-IAM mapping lives in DSQL, not CloudFormation; it is reproduced in
  code and version-controlled via the provisioning path, and verifiable through
  `sys.iam_pg_role_mappings` and `information_schema.role_table_grants`.
- The pipeline continues to use `admin`; tightening it to a least-privilege
  read/write role is possible later but is lower priority (it is not publicly
  reachable).

## Alternatives considered

- **Connect the API as `admin` with parameterized queries only.** Rejected: it
  leaves the public path holding write/DDL privileges; one bug bounds to total
  corpus loss rather than to reading public data.
- **Enforce read-only in application code (e.g. a query allow-list).** Rejected:
  app-layer guards are bypassable and easy to regress; the database is the
  correct, unbypassable place to enforce least privilege.
