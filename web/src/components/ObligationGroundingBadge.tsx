import { useState, useEffect } from "react";
import { fetchGrounding, type GroundingApiRow } from "../api.ts";
import { indexGroundings } from "../grounding.ts";
import { GroundingDisplay } from "./Badges.tsx";

/** The id of the obligation page's grounding mount (shared with prerender). */
export const OBLIGATION_GROUNDING_ROOT_ID = "obligation-grounding-root";

/**
 * The grounding badge on an obligation detail page as a hydrated island
 * (ADR-0028). Renders the seed citation's grounding on first paint, then
 * fetches `/api/grounding` and shows the live grounding for this obligation if
 * the corpus has grounded it — keeping the page consistent with the Regimes
 * index and the as-of slider. The obligation id comes from the mount's
 * `data-obligation-id`, read by the client entry.
 */
export function ObligationGroundingBadge(props: {
  readonly obligationId: string;
}): React.ReactElement {
  const [live, setLive] = useState<GroundingApiRow | null>(null);

  // Fetch once on mount. The seed citation (rendered server-side) is ungrounded,
  // so the badge stays ungrounded until — and unless — the live fetch grounds
  // this obligation. A post-unmount setState is a no-op under React 18.
  useEffect(() => {
    fetchGrounding()
      .then((data) =>
        setLive(indexGroundings(data.groundings).get(props.obligationId) ?? null),
      )
      .catch(() => setLive(null));
  }, [props.obligationId]);

  return (
    <GroundingDisplay
      grounded={live?.grounded ?? false}
      {...(live?.confidence !== undefined ? { confidence: live.confidence } : {})}
      {...(live?.method !== undefined ? { method: live.method } : {})}
      {...(live?.quote !== undefined ? { quote: live.quote } : {})}
    />
  );
}
