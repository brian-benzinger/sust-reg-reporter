# 0002 — Primary-source pinned, non-interpretive product scope

- **Status:** Accepted
- **Date:** 2026-05-30

## Context

The product operates in a legal/regulatory domain. Users may be tempted to
treat its output as legal advice. Interpreting regulations — telling a user
what a rule *means for them* or what they *must do* — is both a legal-liability
hazard and an accuracy trap, because it requires four-nines correctness that an
LLM-in-the-loop system cannot honestly promise.

## Decision

The product is **primary-source pinned and deliberately non-interpretive**. It
returns:

- source text,
- citations,
- effective dates, and
- applicability metadata.

It does **not** interpret regulations or give legal advice. This constraint is
simultaneously the safety posture and the source of trust: by refusing to
editorialize, the tool makes itself verifiable against the primary source.

## Consequences

- Trust derives from verifiability, not authority. Every answer can be checked
  against the cited primary source (see [ADR-0004](0004-citation-integrity.md)).
- The accuracy bar becomes "did we faithfully reproduce and locate the source
  text," not "did we correctly interpret the law" — a bar the architecture can
  actually meet.
- The applicability engine ([ADR-0005](0005-applicability-engine.md)) reports
  *which obligations apply and by when* as structured fact derived from
  thresholds, not as advice. The boundary between "applies to you" (factual,
  threshold-driven) and "here is what you should do" (advice, out of scope) is
  held strictly.
- Product copy, API responses, and the web UI must carry clear "not legal
  advice" framing.

## Alternatives considered

- **Interpretive guidance / Q&A over the law.** Rejected: unbounded liability,
  requires accuracy the system can't guarantee, and erodes the verifiability
  that is the whole value proposition.
