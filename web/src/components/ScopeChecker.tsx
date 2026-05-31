import { useState } from "react";
import {
  type ApplicabilityResult,
  type ListingStatus,
  type Obligation,
  caRegime,
} from "@sust-reg/core";
import {
  DEFAULT_FORM_INPUT,
  LISTING_STATUSES,
  parseProfile,
  runScopeCheck,
  type ScopeFormInput,
} from "../scope-checker.ts";

/** The id of the element the client hydrates into (shared with prerender). */
export const SCOPE_CHECKER_ROOT_ID = "scope-checker-root";

function ResultItem(props: {
  readonly result: ApplicabilityResult;
}): React.ReactElement {
  const { result } = props;
  const className = result.applies
    ? result.enforceable
      ? "result applies enforceable"
      : "result applies"
    : "result excluded";

  return (
    <article className={className}>
      <h3>{result.obligation.title}</h3>
      <p className="meta">
        {result.obligation.regime}
        {result.applies && result.enforceable ? " · enforcement active" : ""}
      </p>
      <p className={result.applies ? "verdict yes" : "verdict no"}>
        {result.applies ? "Applies" : "Does not apply"}
      </p>
      <ul className="reasons">
        {result.reasons.map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
      </ul>
      {result.dueBy !== undefined ? (
        <p className="due">First reporting deadline: {result.dueBy}</p>
      ) : null}
    </article>
  );
}

/**
 * The Scope Checker (ADR-0005 made interactive). A thin shell over the pure
 * `scope-checker` logic and the shared applicability engine; it computes live
 * from the current form state, so the prerendered HTML and the hydrated client
 * agree on the initial render.
 */
export function ScopeChecker(props: {
  /** Corpus to evaluate against; defaults to the v1 seed obligations. */
  readonly obligations?: readonly Obligation[];
}): React.ReactElement {
  const obligations = props.obligations ?? caRegime.CALIFORNIA_OBLIGATIONS;
  const [input, setInput] = useState<ScopeFormInput>(DEFAULT_FORM_INPUT);
  const update = (patch: Partial<ScopeFormInput>): void =>
    setInput((prev) => ({ ...prev, ...patch }));

  const { profile, errors } = parseProfile(input);
  const view = runScopeCheck(profile, obligations);

  return (
    <>
      <form
        className="scope"
        onSubmit={(event) => {
          event.preventDefault();
        }}
      >
        <div className="fields">
          <label>
            Total annual revenue (USD)
            <input
              type="number"
              min="0"
              value={input.revenue}
              onChange={(e) => update({ revenue: e.target.value })}
            />
          </label>
          <label>
            Jurisdictions
            <span className="hint">space- or comma-separated, e.g. US-CA US</span>
            <input
              type="text"
              value={input.jurisdictions}
              onChange={(e) => update({ jurisdictions: e.target.value })}
            />
          </label>
          <label>
            Listing status
            <select
              value={input.listingStatus}
              onChange={(e) => update({ listingStatus: e.target.value })}
            >
              {LISTING_STATUSES.map((status: ListingStatus) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label>
            Fiscal year end (MM-DD)
            <input
              type="text"
              value={input.fiscalYearEnd}
              onChange={(e) => update({ fiscalYearEnd: e.target.value })}
            />
          </label>
        </div>
      </form>

      {errors.length > 0 ? (
        <div className="errors" role="alert">
          <strong>Check the form:</strong>
          <ul>
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="summary">
        {view.applicableCount} of {view.results.length} obligation(s) apply;{" "}
        {view.enforceableCount} currently enforced.
      </p>

      {view.results.map((result) => (
        <ResultItem key={result.obligation.id} result={result} />
      ))}
    </>
  );
}
