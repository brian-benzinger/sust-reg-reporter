# 0035 — Span-level grounding via deterministic text-quote anchors

- **Status:** Accepted
- **Date:** 2026-06-20

## Context

[ADR-0028](0028-ground-obligations-via-append-only-grounding-facts.md) grounds
each obligation to the immutable snapshot that substantiates it, but only at
**document level**: a grounding fact pins the obligation to a whole snapshot
(`span_start`/`span_end` are null). §4 of that ADR sequenced character-offset
spans as the additive next step — "via a locator (section anchor / heading /
pattern) on the obligation, resolved against the snapshot text and carrying an
extraction confidence" — and shipped the nullable span columns so adding spans
needs **no migration**. It did not, however, fix *which* locator mechanism we
use. This ADR does.

Three standing constraints shape the choice:

- **Anti-hallucination is the whole point.** Invariant #2 and
  [ADR-0004](0004-citation-integrity.md) require every claim to pin to an exact
  source span; a span we cannot deterministically verify against the stored
  snapshot is worse than no span.
- **Always-Free and content-hash-gated.** [ADR-0016](0016-aws-always-free-cost-discipline.md)
  and [ADR-0007](0007-change-detection-via-semdiff.md) keep recurring cost at
  zero and external LLM calls gated behind real content change. Span resolution
  runs on every (changed) snapshot, so it must be free and not call an LLM.
- **The quality layer is deterministic and testable.**
  [ADR-0017](0017-reliability-and-quality-layer.md) and the per-file coverage
  gate ([ADR-0019](0019-vitest-testing-and-coverage.md)) favour pure logic with
  explicit confidence over opaque extraction.

## Decision

Locate an obligation's span with a **text-quote anchor**, resolved by
deterministic string search against the snapshot text — the same idea as a W3C
Web Annotation `TextQuoteSelector`, kept minimal.

1. **Obligations carry an optional `locator`** (`core`): a verbatim `quote`
   drawn from the source, plus optional `prefix`/`suffix` context to
   disambiguate repeated quotes. An obligation with no locator stays
   document-level, exactly as today.

2. **`resolveSpan(locator, snapshotText)` is pure `core` logic** returning the
   character offsets and an extraction **confidence**, reusing the existing
   `GroundingConfidence` (`high` / `medium` / `low`) from ADR-0028:
   - **high** — the quote occurs exactly once, or `prefix`/`suffix` narrow
     repeated occurrences to exactly one.
   - **medium** — the quote occurs more than once and the context (or its
     absence) leaves more than one candidate; the first occurrence is taken.
   - **low** — `prefix`/`suffix` were given but match no occurrence (stale or
     wrong context); the first raw occurrence is taken.
   - **unresolved** — the quote is absent; `resolveSpan` returns `undefined`.

3. **The grounding step degrades gracefully.** When a locator resolves, the
   ingestor appends a `method: "span"` grounding with the offsets and the
   resolved confidence; when it does not, it falls back to the existing
   `method: "document"` grounding (ADR-0028 §5). A span is only ever served if
   it was verified against the very snapshot it pins to — never asserted blind.

4. **No new schema and no LLM.** The span columns already exist (ADR-0028 §4);
   resolution is exact-substring matching over text we already store. It is free
   under Always-Free and adds no Anthropic spend.

This ADR **refines [ADR-0028](0028-ground-obligations-via-append-only-grounding-facts.md) §4**;
it does not supersede it. Append-only grounding, transaction-time resolution,
and the derived citation are unchanged — a span grounding is just a later,
more precise fact in the same history.

## Consequences

- Spans are **precise and self-verifying**: an offset always corresponds to text
  actually present in the pinned snapshot, so the UI can highlight the exact
  substantiating passage without trusting an extractor.
- **Free and deterministic**, so it holds to the coverage gate and the
  Always-Free budget; re-resolution happens automatically on each new snapshot,
  riding the content-hash gate (no change → no re-resolution).
- Anchors must be **curated per obligation** and can go **stale** when a source
  is reworded. This is bounded: a stale anchor degrades to `low` or to
  document-level grounding rather than producing a wrong span, and is corrected
  by updating the `quote`. The v1 corpus is small (ADR-0009), so curation is
  cheap.
- Quote-only matching is **offset-faithful but literal** — it does not absorb
  whitespace re-wrapping or markup normalization differences between the
  rendered source and the stored snapshot. Normalized/fuzzy matching is a
  deliberate follow-up (see Alternatives); the confidence ladder already makes
  approximate matches visible rather than silent.

## Alternatives considered

- **Section / heading anchor** (e.g. "§ 38533", "Article 19a"): also
  deterministic and free, and robust to body edits, but spans a whole section
  rather than the operative sentence, and depends on stable, machine-locatable
  numbering in the normalized snapshot. Kept as a complementary future locator
  kind, not the v1 default.
- **LLM span extraction:** most flexible, but costs money outside AWS, is
  non-deterministic (hard to hold to the coverage gate), and asserts a span the
  system cannot independently verify — squarely against ADR-0004, ADR-0016, and
  ADR-0017. Rejected for v1.
- **Normalized-whitespace / fuzzy matching first:** would tolerate re-wrapping,
  but mapping a match in normalized text back to exact offsets in the original
  snapshot is error-prone and harder to test. Deferred; exact matching with an
  honest confidence ships the verifiable 80% now.
- **Storing offsets statically on the obligation:** brittle — offsets are
  meaningless across snapshot versions, and re-grounding to a new snapshot would
  silently break them. The locator is version-independent by construction.
