/**
 * Browser entry (ADR-0021): hydrates the interactive islands in place over the
 * prerendered HTML. Currently just the Scope Checker. This file is the
 * client-side glue — it is bundled by webpack and excluded from the coverage
 * gate; the logic it mounts lives in tested modules.
 */
import { hydrateRoot } from "react-dom/client";
import {
  ScopeChecker,
  SCOPE_CHECKER_ROOT_ID,
} from "./components/ScopeChecker.tsx";

const container = document.getElementById(SCOPE_CHECKER_ROOT_ID);
if (container !== null) {
  hydrateRoot(container, <ScopeChecker />);
}
