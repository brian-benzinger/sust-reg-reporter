# 0028 — Ground obligations to ingested snapshots via append-only grounding facts

- **Status:** Accepted
- **Date:** 2026-06-02

## Context

Every obligation in the corpus still carries the ungrounded seed citation
(`ungrounded:seed`). Invariant #2 and [ADR-0004](0004-citation-integrity.md)
require every regulatory claim to be grounded in a stored source span pinned to
a **version** and a **retrieval date**; the reliability layer
([ADR-0017](0017-reliability-and-quality-layer.md)) flags or refuses ungrounded
data rather than serving it as fact.

The pipeline now produces what grounding needs: stable, content-addressed
snapshots ([ADR-0011](0011-content-addressed-snapshot-store.md)) recorded as
append-only `source_versions` (content hash + `retrieved_at`), and — since the
HTML-normalization work — a content hash that changes only when the *document*
changes ([ADR-0007](0007-change-detection-via-semdiff.md)). What is missing is
the **link** from an obligation to the snapshot that substantiates it.

Three forces constrain how we make that link:

- **[ADR-0003](0003-bitemporal-data-model.md): never mutate records in place or
  destroy prior versions.** Grounding is itself a fact that changes over time —
  an obligation re-grounds to a new snapshot whenever its source changes.
- **The obligation→source association is not represented yet.** Obligations
  carry a human-readable `source.label` / `sourceUrl` but not the registry
  `source_key`, so nothing knows which ingested source substantiates which
  obligation.
- **DSQL** is Postgres-*compatible* but enforces no foreign keys and has no
  `jsonb` ([ADR-0012](0012-aurora-dsql-data-store.md)); integrity and shapes
  live in application code.

## Decision

Represent grounding as **append-only grounding facts**, mirroring the bitemporal
status-history pattern — not as a mutable field on the obligation row.

1. **Obligations declare their source.** Add a `sourceKey` to the obligation
   model (the registry key from `ingest/src/sources.ts`), so the pipeline knows
   which ingested source substantiates each obligation. One source may ground
   several obligations (e.g. the CSRD source grounds both ESRS waves); in v1
   each obligation grounds to one primary source.

2. **A new append-only table `obligation_groundings`:**
   - `id` uuid, `obligation_id`, `source_key`
   - `source_version_id` — the immutable snapshot it pins to (an app-level
     reference into `source_versions`; DSQL enforces no FK)
   - `content_hash` — the denormalized snapshot hash (also the S3 key, ADR-0011)
   - `span_start`, `span_end` — character offsets within the snapshot,
     **nullable** (null = document-level grounding, for now)
   - `retrieved_at` — the snapshot's retrieval date (the provenance anchor)
   - `recorded_at` — transaction time: when we established this grounding
   - `method`, `confidence` — how it was grounded and how sure (ADR-0017)

   Re-grounding to a newer snapshot **appends** a row; nothing is updated or
   deleted. The current grounding is the latest fact, resolvable as-of a
   knowledge date ([ADR-0022](0022-in-code-bitemporal-representation.md)).

3. **The served citation is derived, not stored.** An obligation's
   `SourceCitation` is resolved from its latest grounding fact (→ `snapshotHash`,
   `retrievedAt`, `span`). With no grounding fact, the obligation is ungrounded
   and the reliability layer flags it (invariant #2). The existing
   `obligations.source_snapshot_hash` column becomes seed-only/vestigial — the
   live truth is the groundings table; `isGrounded` already keys off the
   sentinel.

4. **Document-level grounding first; spans deferred.** Pinning to a snapshot
   version + retrieval date already satisfies invariant #2's "version and
   retrieval date." Character-offset spans (locating an obligation's exact text
   within the snapshot) are a harder extraction problem; sequence them next via
   a locator (section anchor / heading / pattern) on the obligation, resolved
   against the snapshot text and carrying an extraction confidence. The schema
   ships the nullable span columns now, so adding spans needs no migration.

5. **The ingestor grounds as snapshots arrive, idempotently.** After it appends
   a `source_version` for source *S* — which, post-ADR-0007, happens only when
   the document changed — it appends a document-level grounding for every
   obligation whose `sourceKey == S`, pointing at the new version, **skipping if
   a grounding for that `(obligation_id, content_hash)` already exists** (the
   same "append only when absent" idempotency as the seed; ADR-0017).
   `corpusSeed` performs a one-time backfill against the latest existing
   `source_version`, so obligations seeded after their source was first ingested
   converge. Grounding is content-hash-gated by construction (no new version →
   no new grounding) and never re-bills an LLM call.

## Consequences

- Grounding history is preserved: we can answer "what snapshot grounded this
  obligation, as of our knowledge on date D" — the same discipline as status
  (ADR-0003 / ADR-0022), composing with the as-of slider.
- Re-grounding is automatic and free: when a source changes, the next poll
  snapshots it, and the `semdiff` result and a fresh grounding land together.
- Ungrounded obligations stay visibly ungrounded (the `GroundedBadge` and the
  API already surface this) until a real snapshot substantiates them — honest by
  default, and within Always-Free (a tiny table, a few inserts per change, no
  LLM or extra AWS cost; ADR-0016).
- More moving parts than a single column: a new table, an obligation→source
  mapping, and citation resolution on read. That is the deliberate cost of not
  mutating provenance.
- Document-level grounding delivers value now (claims pin to a real, retrievable
  snapshot) without blocking on span extraction, which becomes an additive
  follow-up.

## Alternatives considered

- **Update `obligations.source_snapshot_hash` in place.** Simplest — the column
  exists. Rejected: it mutates a record and destroys the prior grounding,
  squarely violating ADR-0003; it cannot answer "grounded to what, as of when,"
  races reads during re-grounding, and breaks the bitemporal story the product
  is built on.
- **Store only the latest content hash, no version pin.** Rejected: invariant #2
  wants a version *and* a retrieval date; a bare hash drops the
  retrieval/transaction context and the link to the immutable `source_version`.
- **Span-level grounding first.** Rejected for v1: locating exact character
  offsets per obligation is an extraction/quality problem (ADR-0017) that should
  not gate the simpler, already-valuable document-level pin. Sequenced next; the
  schema is span-ready.
- **Ground in the differ rather than the ingestor.** Rejected: the differ runs
  only when there is a *prior* version to diff against, so a source's first
  snapshot would never ground. The ingestor sees every new version (including
  the first) and already holds the `source_key` and version id.
- **Carry a JSON grounding history on the obligation row.** Rejected: DSQL has
  no `jsonb` (ADR-0012), and an append-only sibling table matches the existing
  `obligation_status_history` shape and queries.
