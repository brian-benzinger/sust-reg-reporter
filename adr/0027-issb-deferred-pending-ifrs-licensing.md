# 0027 — ISSB deferred from the v1 corpus pending an IFRS Sustainability licence

- **Status:** Accepted
- **Date:** 2026-06-02

## Context

[ADR-0009](0009-v1-scope-three-regimes.md) set the v1 scope at three regimes:
California SB 253/261, EU CSRD, and **ISSB S1/S2**. While wiring ISSB into the
corpus we checked the IFRS Foundation's actual terms of use (primary sources,
not assumptions):

- *"The ISSB Standards can be used for free for **personal non-commercial
  purposes**, such as preparing corporate disclosures. **Any other use, such as
  their integration into reporting software, investment analysis, data services
  and product development, is not permitted without a separate licence** from
  the IFRS Foundation."*
- *"Any use requiring **reproduction, translation, editing or distribution** of
  IFRS Standards in whole or in part **will require a separate permission or
  licence** from the IFRS Foundation."*

This product is exactly the restricted case: it ingests, stores
(content-addressed snapshots, [ADR-0011](0011-content-addressed-snapshot-store.md)),
diffs, and serves primary-source **spans** of the regulations it tracks
([ADR-0004](0004-citation-integrity.md)) — a "data service / product
development" use that reproduces and redistributes the text. We hold no IFRS
Sustainability licence.

Unlike the other v1 regimes — California (leginfo) and EU CSRD (EUR-Lex), whose
primary sources are public-domain government law — the ISSB standards text is
copyright of the IFRS Foundation. It therefore **cannot be grounded or served
the way the rest of the corpus is** without a licence, and an obligation that
can never be grounded to a real, servable snapshot has little value in a
primary-source-pinned product ([ADR-0002](0002-primary-source-non-interpretive-scope.md)).

## Decision

**Defer ISSB (IFRS S1/S2) from the v1 corpus.** Remove the ISSB obligations and
status histories, and do not add an ISSB fetch source. v1 ships **two regimes**
— California SB 253/261 and EU CSRD — until an IFRS Sustainability licence is in
place.

This **supersedes the ISSB portion of [ADR-0009](0009-v1-scope-three-regimes.md)**;
the rest of that ADR's rationale (high-churn, well-documented, cross-jurisdiction)
still holds for the remaining two regimes.

## Consequences

- The corpus is narrower, but the architecture is still fully exercised: the
  bitemporal model by the SB 261 enforcement stay and the EU Omnibus
  "stop-the-clock," the status enum by `proposed`/`in-effect`/`stayed`, and the
  applicability engine across US and EU thresholds.
- Re-adding ISSB is gated on obtaining a licence (contact
  `sustainability_licensing@ifrs.org`) and would be its own change — modeling,
  a source adapter, and the licence on record.
- We remove the ISSB *metadata* too, not just the text fetch. Modeling pure
  facts (titles, dates) is likely defensible, but the conservative margin is
  cheap and avoids a regime that we cannot complete legally.

## Alternatives considered

- **Keep ISSB metadata only, never fetch the text.** Rejected: the product's
  value is grounding and serving spans, which we cannot license now; a
  text-less ISSB regime is hollow and muddies the "every claim pins to a real
  snapshot" model.
- **Obtain an IFRS Sustainability licence now.** Out of scope and cost for v1;
  revisit when the rest of the corpus is grounded and the product's direction
  justifies it.
- **Rely on fair use / fair dealing.** Rejected: the terms are explicit and the
  use is commercial-style redistribution; not a risk worth taking for a
  trust-first product.

## Sources

- IFRS — IFRS Sustainability Licensing:
  <https://www.ifrs.org/products-and-services/sustainability-products-and-services/ifrs-sustainability-licensing/>
- IFRS — Intellectual Property: <https://www.ifrs.org/legal/intellectual-property/>
- IFRS — Licensing of IFRS Standards for adoption and jurisdictional use:
  <https://www.ifrs.org/use-around-the-world/adoption-and-copyright/>
