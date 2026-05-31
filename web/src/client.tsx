/**
 * Browser entry (ADR-0021): hydrates the interactive islands in place over the
 * prerendered HTML — the Scope Checker and the as-of-date slider. This file is
 * client-side glue; it is bundled by webpack and excluded from the coverage
 * gate. The logic it mounts lives in tested modules.
 */
import type { ReactElement } from "react";
import { hydrateRoot } from "react-dom/client";
import {
  ScopeChecker,
  SCOPE_CHECKER_ROOT_ID,
} from "./components/ScopeChecker.tsx";
import {
  AsOfSlider,
  AS_OF_SLIDER_ROOT_ID,
} from "./components/AsOfSlider.tsx";

function hydrateIsland(id: string, element: ReactElement): void {
  const container = document.getElementById(id);
  if (container !== null) {
    hydrateRoot(container, element);
  }
}

hydrateIsland(SCOPE_CHECKER_ROOT_ID, <ScopeChecker />);
hydrateIsland(AS_OF_SLIDER_ROOT_ID, <AsOfSlider />);
