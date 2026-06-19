# 0033 — Pipeline observability: health alarms, alerts, and a dashboard

- **Status:** Accepted
- **Date:** 2026-06-19

## Context

The ingest pipeline (ADR-0010) is a daily EventBridge cron → ingestor Lambda →
(on a content-hash change) differ Lambda, with an SQS dead-letter queue for
failed scheduled invocations. Once deployed it runs unattended, and that is
exactly the problem: it ran for weeks with no way, short of manually reading
CloudWatch, to answer "is the backend still running daily, and is it healthy?"

The failure modes are real and silent. The EventBridge schedule could be
disabled and nothing would fire. A source could begin returning a `403`/captcha
to the Lambda's IP (EUR-Lex is known to block datacenter ranges) so the poll
"succeeds" daily while tracking nothing. A scheduled invoke could exhaust its
retries into the DLQ. None of these surface anywhere a human looks.

The one alarm we already had — the `$1` monthly budget (ADR-0016) — is a **cost**
backstop. It says nothing about pipeline health; a pipeline that silently stopped
running would, if anything, make the budget alarm *quieter*. Cost monitoring and
health monitoring are different questions and need different instruments.

Whatever we add has to stay inside the Always-Free envelope (ADR-0016).

## Decision

Add operational observability to the `PipelineStack`, alongside the resources it
already owns so the alarms reference the Lambdas and DLQ directly (no new
cross-stack coupling):

- **An SNS topic with an email subscription.** Pipeline alarms fan out to it.
  The address is supplied at deploy via `SUSTREG_ALERT_EMAIL`, defaulting to the
  budget inbox (`SUSTREG_BUDGET_EMAIL`) so one operator address covers both;
  it is validated at synth by the shared `assertValidEmail` (factored out of the
  CostStack check) so an alarm is never deployed emailing nobody.
- **Four CloudWatch alarms**, each notifying on both trip and recovery:
  1. **Ingestor not running** — `Invocations < 1` over a one-day window with
     *missing data treated as breaching*. This is the direct, paged answer to
     "is the backend running daily": a disabled schedule produces no datapoint
     and therefore alarms, rather than looking healthy.
  2. **Ingestor errors** — any errored scheduled invocation.
  3. **Differ errors** — a failed `semdiff` run (a needed diff may be missing;
     it can be re-requested via the rediff op, ADR-0007).
  4. **DLQ not empty** — a scheduled invoke was dead-lettered after its retries.
- **One CloudWatch dashboard** (`SustReg-Pipeline`): an alarm-status banner plus
  ingestor/differ invocation, error, and duration graphs and the DLQ depth, over
  a 14-day window to match the log retention.

## Consequences

- "Is it running daily, and is it healthy?" is answered at a glance and pushed to
  a human on failure, instead of requiring a manual log dig.
- Cost alarms (ADR-0016) and health alarms stay cleanly separated — each answers
  the question it is actually about.
- Still `$0`/month: fewer than 10 alarms (the always-free allowance), one SNS
  topic, and one of the three always-free dashboards; SNS email stays inside the
  free-tier notification allowance. The cost-guardrail Aspects (ADR-0016) see no
  forbidden resource.
- The email subscription requires a one-time confirmation click after the first
  deploy; until confirmed, alarms fire but no mail is delivered.
- The "not running" alarm can briefly read `INSUFFICIENT_DATA`/alarm on a fresh
  deploy until the first daily datapoint lands; seeding one ingestor invocation
  at deploy time avoids a spurious first alert.

## Alternatives considered

- **A separate `MonitoringStack`.** Rejected for now: it would have to import the
  function names and DLQ across stacks for no real benefit at this size, and the
  pipeline stack is already the natural, stateless owner of its own alarms.
- **Reusing the `$1` budget alarm as the health signal.** Rejected: it measures
  spend, not liveness, and a stalled pipeline spends *less*, so it would mask the
  exact failure we care about.
- **A custom "last successful run" metric + structured run logging.** Deferred,
  not rejected: a worthwhile follow-up that makes the dashboard richer, but the
  Lambda-level metrics above already answer the liveness/health question and ship
  without touching the ingest handler.
