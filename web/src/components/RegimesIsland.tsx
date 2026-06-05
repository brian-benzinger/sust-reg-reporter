import { useState, useEffect } from "react";
import { ALL_OBLIGATIONS } from "@sust-reg/core";
import { regimeGroups, type RegimeGroup } from "../model.ts";
import { RegimesIndex } from "./RegimesIndex.tsx";
import { fetchGrounding } from "../api.ts";
import { indexGroundings, type GroundingIndex } from "../grounding.ts";

/** The id of the element the client hydrates into (shared with prerender). */
export const REGIMES_ROOT_ID = "regimes-root";

/**
 * The Regimes index as a hydrated island (ADR-0028). It renders the seed-derived
 * cards on first paint (prerender-compatible — same markup as a bare
 * `RegimesIndex`), then fetches `/api/grounding` and overlays live grounding so
 * each card agrees with the as-of slider. On a fetch failure it simply keeps the
 * seed badges — degrade gracefully, never block the page.
 */
export function RegimesIsland(props: {
  /** Groups to render; defaults to the v1 corpus so the client needs no props. */
  readonly groups?: readonly RegimeGroup[];
}): React.ReactElement {
  const groups = props.groups ?? regimeGroups(ALL_OBLIGATIONS);
  const [groundings, setGroundings] = useState<GroundingIndex | null>(null);

  // Fetch once on mount (no deps). No cancellation guard is needed: there is no
  // re-fetch to race, and a post-unmount setState is a no-op under React 18.
  useEffect(() => {
    fetchGrounding()
      .then((data) => setGroundings(indexGroundings(data.groundings)))
      .catch(() => setGroundings(null));
  }, []);

  return (
    <RegimesIndex
      groups={groups}
      {...(groundings !== null ? { groundings } : {})}
    />
  );
}
