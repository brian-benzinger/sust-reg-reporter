# 0006 — Model regulation status states explicitly

- **Status:** Accepted
- **Date:** 2026-05-30

## Context

A regulation's lifecycle is not a single "active/inactive" bit. A rule can be
**proposed**, **in-effect**, actively **enforced**, or **stayed** (law on the
books but enforcement paused, e.g. pending appeal). These states have different
consequences for a company.

The concrete cautionary example: **SB 261** has been technically law while
enforcement was paused pending appeal. A naive tool that collapses status into
a boolean gets this catastrophically wrong — either telling a company it must
comply when enforcement is stayed, or telling it the law doesn't exist.

## Decision

Model regulation status as an **explicit, enumerated state**, distinguishing at
minimum:

- **proposed** — not yet law,
- **in-effect** — legally in force,
- **enforced** — in force and being actively enforced,
- **stayed** — in force but enforcement paused.

Status is a first-class, bitemporally-versioned attribute, so the system can
report not just the current status but the status as-of any date and how it
changed.

## Consequences

- The applicability engine ([ADR-0005](0005-applicability-engine.md)) can
  correctly answer "this applies to you, but enforcement is currently stayed,"
  which is materially different from "this does not apply."
- Status transitions are themselves change events worth diffing and surfacing
  ([ADR-0007](0007-change-detection-via-semdiff.md)).
- Requires careful sourcing: status changes (stays, appeals) may come from
  dockets and court actions, reinforcing authoritative-source ingestion
  ([ADR-0008](0008-authoritative-source-ingestion.md)).

## Alternatives considered

- **Boolean active/inactive flag.** Rejected: cannot represent the
  stayed-but-law condition; produces dangerously wrong answers.
- **Free-text status note.** Rejected: not queryable, not enforceable, can't
  drive the applicability logic.
