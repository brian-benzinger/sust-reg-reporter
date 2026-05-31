import { NOT_LEGAL_ADVICE } from "../content.ts";
import { ScopeChecker, SCOPE_CHECKER_ROOT_ID } from "./ScopeChecker.tsx";

/**
 * The Scope Checker page. The interactive component is wrapped in a mount
 * element whose id is shared with the client entry, so prerendered markup is
 * hydrated in place (an island) rather than re-rendered from scratch.
 */
export function ScopeCheckerPage(): React.ReactElement {
  return (
    <>
      <h1>Scope checker</h1>
      <p className="lead">
        Enter a company profile to see which modeled disclosure obligations
        apply, why, and whether enforcement is currently active.
      </p>
      <div className="notice">{NOT_LEGAL_ADVICE}</div>
      <div id={SCOPE_CHECKER_ROOT_ID}>
        <ScopeChecker />
      </div>
    </>
  );
}
