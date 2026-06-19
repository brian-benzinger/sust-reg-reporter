/**
 * Shared synth-time validation for operator notification addresses (ADR-0016,
 * ADR-0033).
 *
 * Both the $1 budget alarm (CostStack, ADR-0016) and the pipeline health alarms
 * (PipelineStack, ADR-0033) email a human when something is wrong. An alarm that
 * emails nobody — a blank address — or an obvious copy-paste placeholder is worse
 * than useless: it reads as "monitored" while silently notifying no one. So a bad
 * address fails `cdk synth` rather than deploying a disabled alert.
 */

/** Addresses that look like a copy-paste placeholder rather than a real inbox. */
export const PLACEHOLDER_EMAILS = new Set([
  "you@example.com",
  "changeme@example.com",
]);

/**
 * Return `email` trimmed, or throw if it is empty, a known placeholder, or has no
 * `@`. `label` names the offending input in the error (e.g. "budgetEmail",
 * "alertEmail") so a misconfigured deploy says which knob to fix.
 */
export function assertValidEmail(email: string, label: string): string {
  const trimmed = email.trim();
  if (
    trimmed.length === 0 ||
    PLACEHOLDER_EMAILS.has(trimmed) ||
    !trimmed.includes("@")
  ) {
    throw new Error(
      `${label}: a real email address is required or the alert is silently ` +
        `disabled (ADR-0016, ADR-0033); got ${JSON.stringify(email)}`,
    );
  }
  return trimmed;
}
