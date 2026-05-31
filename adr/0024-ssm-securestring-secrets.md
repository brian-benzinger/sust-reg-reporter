# 0024 — SSM Parameter Store SecureString for app secrets

- **Status:** Accepted
- **Date:** 2026-05-31

## Context

The differ needs an Anthropic API key for semdiff's classifier (ADR-0007), and
more secrets may follow. They must be encrypted at rest, access-controlled, and
kept out of git and out of the CloudFormation template — while still fitting the
Always-Free cost discipline (ADR-0016), where the $1 budget alarm is the
backstop.

AWS Secrets Manager — the design pass's suggestion — is **$0.40 per secret per
month** (plus per-API-call): ~40% of the $1 budget for a single key, with a free
*trial* only, not a free tier. Its rotation / cross-account features buy us
nothing here.

## Decision

Store app secrets in **SSM Parameter Store `SecureString`** parameters under
`/sust-reg/`. Standard-tier parameters are **free**; `SecureString` encrypts the
value with the **AWS-managed `aws/ssm` KMS key** (also free — only
customer-managed keys carry a monthly charge), and KMS `Decrypt` calls fall
inside the account's always-free 20,000-request/month KMS tier.

Secret *values* are set out of band (`aws ssm put-parameter --type SecureString`)
— never in git, the CDK template, or through an assistant. CloudFormation cannot
create `SecureString` values, which reinforces the boundary: CDK only **grants**
read access (`ssm:GetParameter` on the parameter ARN + `kms:Decrypt` scoped to
`kms:ViaService = ssm`) and passes the parameter *name* as an env var. The Lambda
fetches and decrypts the value at cold start.

## Consequences

- Encrypted-at-rest, access-controlled secrets at **$0/month**, inside the
  Always-Free envelope (ADR-0016).
- Secret values live only in SSM — never in source or the template.
- A little runtime code (a cold-start `GetParameter` with decryption) replaces a
  managed-secret SDK lookup; acceptable for the cost saving.
- If a secret ever needs automatic rotation or cross-account sharing, that
  specific secret can move to Secrets Manager under a superseding decision.

## Alternatives considered

- **AWS Secrets Manager.** Rejected: $0.40/secret/month is a large fraction of
  the $1 budget, for rotation/cross-account features we do not need.
- **Plain Lambda environment variable.** Rejected: the value would sit in the
  CloudFormation template (and thus git, if set in code) and be readable by
  anyone with `lambda:GetFunctionConfiguration` — not an acceptable home for a
  real secret.
