import {
  REGULATION_STATUSES,
  isCurrentlyEnforced,
  isLaw,
} from "@sust-reg/core";
import { statusDescription, statusLabel } from "../model.ts";
import { NOT_LEGAL_ADVICE } from "../content.ts";
import { StatusBadge } from "./Badges.tsx";

/**
 * Reference page explaining the explicit regulation status states (ADR-0006).
 * Data-driven from `core` so the page can never drift from the model: the
 * states, their labels, and the on-the-books / enforcement-active facts are all
 * read from the same functions the rest of the system uses.
 */
export function StatusStatesPage(): React.ReactElement {
  return (
    <>
      <h1>Regulation status states</h1>
      <p className="lead">
        A regulation&rsquo;s status is an explicit lifecycle state &mdash; not a
        single on/off flag. Two separate questions matter: is it on the books,
        and is enforcement currently active?
      </p>
      <div className="notice">{NOT_LEGAL_ADVICE}</div>
      <table className="asof-table">
        <thead>
          <tr>
            <th>State</th>
            <th>Meaning</th>
            <th>On the books?</th>
            <th>Enforcement active?</th>
          </tr>
        </thead>
        <tbody>
          {REGULATION_STATUSES.map((status) => (
            <tr key={status}>
              <td>
                <StatusBadge status={status} label={statusLabel(status)} />
              </td>
              <td>{statusDescription(status)}</td>
              <td>{isLaw(status) ? "Yes" : "No"}</td>
              <td>{isCurrentlyEnforced(status) ? "Yes" : "No"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2>Why &ldquo;stayed&rdquo; is its own state</h2>
      <p>
        A rule can be law while its enforcement is paused &mdash; for example,
        pending an appeal. California SB 261 is the canonical case. A tool that
        collapses this into &ldquo;active&rdquo; or &ldquo;inactive&rdquo; gets
        it wrong in both directions: it either overstates a paused obligation or
        erases one that is still on the books. Keeping{" "}
        <em>on the books</em> and <em>enforcement active</em> as separate facts
        is what lets the <a href="/scope-checker.html">scope checker</a> report
        that an obligation applies while its enforcement is stayed.
      </p>
      <p>
        Status also changes over time, and a later correction can revise what we
        believed about a past date. The{" "}
        <a href="/as-of.html">as-of-date slider</a> makes that history visible.
      </p>
    </>
  );
}
