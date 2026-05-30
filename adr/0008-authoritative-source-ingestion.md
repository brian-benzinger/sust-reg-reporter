# 0008 — Authoritative-source ingestion over HTML scraping

- **Status:** Accepted
- **Date:** 2026-05-30

## Context

The corpus must be sourced from somewhere. Generic HTML scraping is brittle
(markup changes break it), may violate terms of use, and produces low-provenance
data. In a domain where citation integrity is non-negotiable
([ADR-0004](0004-citation-integrity.md)), the *source* of each fact matters as
much as the fact.

## Decision

Pull from **authoritative sources and official APIs**, with provenance recorded
on every snapshot. For the v1 regimes
([ADR-0009](0009-v1-scope-three-regimes.md)) these include:

- the **Federal Register API**,
- **EUR-Lex**,
- **SEC EDGAR**, and
- the **CARB docket**.

The framing is **authoritative-source ingestion with provenance**, not
scraping. Where an official API does not exist, prefer official bulk/document
endpoints over screen-scraping rendered HTML.

## Consequences

- Each snapshot carries trustworthy provenance (source, endpoint, retrieval
  date), feeding citation integrity directly.
- Ingestion is more stable: official APIs change far less often than rendered
  pages, and respect documented terms of use.
- Adding a new regime is primarily about adding a source adapter, which keeps
  the door open to a future reusable ingestion framework
  ([ADR-0001](0001-two-repo-structure.md)).
- Some authoritative sources (e.g. dockets) are less structured; adapters must
  normalize them into the corpus while preserving the raw snapshot.

## Alternatives considered

- **Generic HTML scraping.** Rejected: brittle, low-provenance, and a terms-of-use
  risk — the opposite of the trust posture.
- **Manual curation only.** Rejected: doesn't scale to high-churn regimes and
  defeats automated change detection.
