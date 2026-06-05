import { useState, useEffect } from "react";
import {
  type ApplicabilityResult,
  type ListingStatus,
  type Obligation,
  ALL_OBLIGATIONS,
} from "@sust-reg/core";
import {
  DEFAULT_FORM_INPUT,
  LISTING_STATUSES,
  parseProfile,
  runScopeCheck,
  type ScopeCheckView,
  type ScopeFormInput,
} from "../scope-checker.ts";
import { fetchScopeCheck } from "../api.ts";

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
 * The Scope Checker (ADR-0005 made interactive). Runs the shared applicability
 * engine locally for immediate feedback on every keystroke, and concurrently
 * calls the API (debounced) so live corpus data replaces the seed result once
 * it arrives.
 */
export function ScopeChecker(props: {
  /** Corpus to evaluate against; defaults to the v1 seed obligations. */
  readonly obligations?: readonly Obligation[];
}): React.ReactElement {
  const obligations = props.obligations ?? ALL_OBLIGATIONS;
  const [input, setInput] = useState<ScopeFormInput>(DEFAULT_FORM_INPUT);
  const update = (patch: Partial<ScopeFormInput>): void =>
    setInput((prev) => ({ ...prev, ...patch }));

  // Local computation runs synchronously — no latency, prerender-compatible.
  const { profile, errors } = parseProfile(input);
  const localView = runScopeCheck(profile, obligations);

  // API state: replaces local view when the endpoint responds.
  const [apiView, setApiView] = useState<ScopeCheckView | null>(null);
  const [apiLoading, setApiLoading] = useState(false);

  const view = apiView ?? localView;

  // Call /api/scope-check 400 ms after the last input change.
  // clearTimeout in the cleanup cancels the pending call; if a fetch is already
  // in-flight when input changes, the stale result is harmless — the next fetch
  // overwrites it immediately.
  useEffect(() => {
    const { errors: currentErrors } = parseProfile(input);
    if (currentErrors.length > 0) {
      setApiView(null);
      return;
    }

    const timer = setTimeout(() => {
      setApiLoading(true);
      fetchScopeCheck({
        revenue: input.revenue,
        jurisdictions: input.jurisdictions,
        listingStatus: input.listingStatus,
        fiscalYearEnd: input.fiscalYearEnd,
      })
        .then((data) => {
          setApiView({
            results: data.results,
            applicableCount: data.applicableCount,
            enforceableCount: data.enforceableCount,
          });
        })
        .catch(() => {
          setApiView(null);
        })
        .finally(() => {
          setApiLoading(false);
        });
    }, 400);

    return () => clearTimeout(timer);
  }, [input]);

  return (
    <>
      <form
        className="scope panel"
        onSubmit={(event) => {
          event.preventDefault();
        }}
      >
        <div className="fields">
          <label>
            Total annual revenue (USD)
            <span className="hint">gross annual revenue, e.g. 500000000</span>
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
            <span className="hint">private, or where the shares are listed</span>
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
            <span className="hint">month and day, e.g. 12-31</span>
            <input
              type="text"
              value={input.fiscalYearEnd}
              onChange={(e) => update({ fiscalYearEnd: e.target.value })}
            />
          </label>
        </div>
      </form>

      {/* Reserved-height status row directly under the form: the loading
          indicator toggles in place here, so the summary and result cards
          below never shift as values change and fetches resolve. */}
      <div className="scope-status" role="status" aria-live="polite">
        {apiLoading ? <span className="loading">Checking…</span> : null}
      </div>

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
