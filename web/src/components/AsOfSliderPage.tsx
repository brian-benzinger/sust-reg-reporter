import { NOT_LEGAL_ADVICE } from "../content.ts";
import { AsOfSlider, AS_OF_SLIDER_ROOT_ID } from "./AsOfSlider.tsx";

/**
 * The as-of-date page. Wraps the interactive slider in a mount element whose id
 * is shared with the client entry, so the prerendered markup is hydrated in
 * place (an island).
 */
export function AsOfSliderPage(): React.ReactElement {
  return (
    <>
      <h1>As-of-date slider</h1>
      <p className="lead">
        The bitemporal model made visible: move the dates to see what was in
        effect on a given day &mdash; and what we believed was in effect, as of
        our knowledge on another day.
      </p>
      <div className="notice">{NOT_LEGAL_ADVICE}</div>
      <p>
        The two axes can disagree: a status correction recorded later (for
        example, an enforcement stay) changes what we report for a past date
        without erasing the earlier record.
      </p>
      <div id={AS_OF_SLIDER_ROOT_ID}>
        <AsOfSlider />
      </div>
    </>
  );
}
