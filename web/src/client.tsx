/**
 * Browser entry (ADR-0021): hydrates the interactive islands in place over the
 * prerendered HTML. This file is client-side glue; it is bundled by webpack and
 * excluded from the coverage gate. The logic it mounts lives in tested modules.
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
import {
  SourcesIsland,
  SOURCES_ROOT_ID,
} from "./components/SourcesPage.tsx";
import {
  DiffsIsland,
  DIFFS_ROOT_ID,
} from "./components/DiffsPage.tsx";
import {
  RegimesIsland,
  REGIMES_ROOT_ID,
} from "./components/RegimesIsland.tsx";
import {
  ObligationGroundingBadge,
  OBLIGATION_GROUNDING_ROOT_ID,
} from "./components/ObligationGroundingBadge.tsx";

function hydrateIsland(id: string, element: ReactElement): void {
  const container = document.getElementById(id);
  if (container !== null) {
    hydrateRoot(container, element);
  }
}

hydrateIsland(SCOPE_CHECKER_ROOT_ID, <ScopeChecker />);
hydrateIsland(AS_OF_SLIDER_ROOT_ID, <AsOfSlider />);
hydrateIsland(SOURCES_ROOT_ID, <SourcesIsland />);
hydrateIsland(DIFFS_ROOT_ID, <DiffsIsland />);
hydrateIsland(REGIMES_ROOT_ID, <RegimesIsland />);

// The obligation page badge mounts with the id read from its data attribute, so
// the single island serves every per-obligation page.
const obligationRoot = document.getElementById(OBLIGATION_GROUNDING_ROOT_ID);
if (obligationRoot !== null) {
  hydrateRoot(
    obligationRoot,
    <ObligationGroundingBadge
      obligationId={obligationRoot.dataset.obligationId ?? ""}
    />,
  );
}
