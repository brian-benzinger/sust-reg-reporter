# 0034 — Corpus keyword search: ranked metadata matching, not full-text

- **Status:** Accepted
- **Date:** 2026-06-19

## Context

The thin API (ADR-0013) could list the corpus (`/sources`), resolve it
(`/as-of`, `/scope-check`), and diff it (`/diff`) — but not *search* it. A user
who wants "which obligations mention scope 3?" or "which sources cover CSRD?"
had no way to ask. Search is table-stakes for a corpus people are meant to
explore.

Two forces shape the design. First, the store is **Aurora DSQL**, which is
PostgreSQL-*compatible*, not full Postgres (ADR-0012): `jsonb`, sequences, FK
enforcement, and GiST exclusion constraints are all absent, and **`tsvector` /
GIN full-text indexing is unverified** there. Second, the corpus is *small* — a
handful of obligations and four tracked sources — and the full regulation *text*
lives in immutable **S3 snapshots**, not in DSQL.

## Decision

Add a ranked **keyword search over corpus metadata**, exposed as a sixth API
route and a dedicated web page.

- **Matching is a pure, in-memory ranked substring scan** (`api/src/search.ts`),
  not Postgres full-text. It ranks obligations (title, regime, id, citation
  label) and tracked sources (name, authority, key): a contiguous-phrase hit
  outranks scattered terms, field weights rank a title hit above an id hit, and
  ties break by title/name for a stable order. Being pure, it is fully
  unit-tested under the coverage gate (ADR-0019) and depends on no unverified
  DSQL feature. The corpus is small enough that an in-memory scan is instant.
- **Scope is metadata, not full text.** Searching the snapshot bodies in S3 is a
  deliberate non-goal for v1 — it would mean reading/scanning S3 objects (or
  building an index) in the request path, with cost and latency implications
  against the Always-Free posture (ADR-0016).
- **The route is `GET /api/search?q=`** through the existing pure `serveRoute`;
  no infra change, since `/api/*` is already uncached with query strings
  forwarded. A blank `q` returns empty results, never an unfiltered dump, and the
  not-legal-advice framing (ADR-0002) is carried like every other route.
- **The UI is a dedicated `/search` page**, consistent with the site's
  page-per-capability structure (Scope Checker, As-of slider). It names what it
  searches up front and offers example queries, so the page is honest about
  covering metadata rather than full document text — a persistent header search
  box would imply a full-text power the v1 does not have.

## Consequences

- The corpus is searchable from the site and the API, within Always-Free and
  with no dependency on an unverified DSQL capability.
- Relevance is substring/keyword, not stemmed/semantic: "emission" will not match
  "emit", and there is no synonym handling. Acceptable for a small, curated
  corpus; a real ranking model would be premature here.
- Search does not reach the regulation text itself yet — only titles, regimes,
  citations, and source names. The biggest single upgrade is full-text over the
  S3 snapshots, gated on a cost/latency design (and, if relevance demands it, a
  re-evaluation of DSQL `tsvector` or an external index).

## Alternatives considered

- **Postgres full-text (`tsvector` + GIN) in DSQL.** Rejected for v1: DSQL's
  support is unverified (ADR-0012), and the corpus is far too small to justify
  betting the feature on it. Revisit if/when full-text-over-S3 makes relevance
  ranking matter.
- **Full-text search over the S3 snapshot bodies.** Deferred: highest value but
  heaviest — it needs S3 reads or an index in the request path, a real
  cost/latency design against Always-Free. Recorded as the main follow-up.
- **A global header search box on every page.** Rejected: an always-present
  search bar signals full-document search, which we deliberately did not build;
  the dedicated page frames the (metadata) scope honestly. Promote to a header
  box if full-text search later lands.
