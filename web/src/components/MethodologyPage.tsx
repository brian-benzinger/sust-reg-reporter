import { NOT_LEGAL_ADVICE } from "../content.ts";

/**
 * Reference page describing how the corpus is built and what its guarantees are
 * (and are not). Static prose tying the user-facing claims to the project's
 * design principles: non-interpretive scope (ADR-0002), citation integrity
 * (ADR-0004), the bitemporal model (ADR-0003), and authoritative-source
 * ingestion (ADR-0008).
 */
export function MethodologyPage(): React.ReactElement {
  return (
    <>
      <h1>Methodology</h1>
      <p className="lead">
        What this site does, how each claim is grounded, and the limits you
        should hold it to.
      </p>
      <div className="notice">{NOT_LEGAL_ADVICE}</div>

      <h2>Primary-source, not interpretive</h2>
      <p>
        This site reports source text, citations, effective dates, and
        per-company applicability metadata. It does not interpret regulations,
        weigh how they apply to your facts, or offer an opinion. Applicability
        results are threshold-derived statements, &ldquo;revenue is at or
        above $X&rdquo;, with the reasons shown, never advice about what
        to do.
      </p>

      <h2>Citation integrity</h2>
      <p>
        Every regulatory claim is meant to pin to an exact span of a stored
        source snapshot, tied to a version and a retrieval date. Until a claim
        is backed by a real ingested snapshot it is marked{" "}
        <strong>ungrounded seed data</strong> and must not be relied on as fact.
        The current corpus is illustrative seed data, flagged as such on every
        obligation, so grounded and ungrounded claims are always visually
        distinct.
      </p>

      <h2>Point-in-time history</h2>
      <p>
        Regulations change, and our knowledge of them is corrected over time.
        The corpus preserves two independent dates for every fact: when it was
        true in the world (valid time) and when we recorded it (transaction
        time). That is why the <a href="/as-of.html">as-of-date slider</a> can
        answer both &ldquo;what was in effect on a date&rdquo; and &ldquo;what
        did we believe was in effect, as of our knowledge on another
        date.&rdquo; Records are never edited in place; a correction is a new
        record.
      </p>

      <h2>Authoritative sources</h2>
      <p>
        The intent is to ingest from official sources and APIs (the
        Federal Register, EUR-Lex, SEC EDGAR, the CARB docket) with
        provenance, rather than scraping brittle HTML. Changes are detected by
        content hash so that costly, meaning-aware diffing runs only when a
        source actually changes.
      </p>

      <h2>Where to verify</h2>
      <p>
        Always confirm against the cited primary source, and consult qualified
        counsel for anything that turns on how a rule applies to you. See the{" "}
        <a href="/status-states.html">status states</a> reference for what each
        lifecycle state does and does not imply.
      </p>
    </>
  );
}
