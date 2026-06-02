import { type Route, routeFor, diffIdFrom } from "./routes.ts";
import type { CorpusReader } from "./model.ts";
import {
  evaluateApplicability,
  type CompanyProfile,
  type ListingStatus,
  caRegime,
  resolveValueAsOf,
} from "@sust-reg/core";

/**
 * Not-legal-advice framing carried on every response (ADR-0002): the API returns
 * primary-source text, citations, effective dates, and applicability metadata —
 * never advice.
 */
const DISCLAIMER =
  "Not legal advice. Returns primary-source text, citations, effective dates, and applicability metadata only.";

const VALID_LISTING_STATUSES: readonly string[] = [
  "private",
  "public-us",
  "public-eu",
  "public-other",
];

/** A normalized request: the raw path plus parsed query parameters. */
export interface ApiRequest {
  readonly path: string;
  readonly query: Record<string, string | undefined>;
}

/** The route layer's result, before HTTP serialization. */
export interface ApiResult {
  readonly status: number;
  readonly body: Record<string, unknown>;
}

/**
 * Serve a request against the corpus (ADR-0013). Pure given a `CorpusReader`:
 * resolves the route, reads what it needs, and shapes the JSON body. The HTTP
 * handler is a thin wrapper that builds the reader and serializes the result.
 *
 * Corpus-backed routes (`/sources`, `/diff`) read from DSQL via the reader.
 * Interactive routes (`/scope-check`, `/as-of`) run against the v1 seed
 * obligations from `@sust-reg/core`; when DSQL gains an obligations table the
 * reader will replace the seed call without touching the route logic.
 */
export async function serveRoute(
  reader: CorpusReader,
  req: ApiRequest,
): Promise<ApiResult> {
  const route = routeFor(req.path);
  switch (route) {
    case "health":
      return ok(route, { status: "ok" });
    case "sources":
      return ok(route, { sources: await reader.listSources() });
    case "diff": {
      const id = diffIdFrom(req.path);
      if (id !== undefined) {
        const diff = await reader.getDiff(id);
        return diff
          ? ok(route, { diff })
          : { status: 404, body: meta(route, { message: `No diff "${id}".` }) };
      }
      return ok(route, { diffs: await reader.listDiffs(req.query.source) });
    }
    case "scope-check": {
      const rawRevenue = req.query.revenue ?? "0";
      const revenue = Number(rawRevenue);
      const rawJurisdictions = req.query.jurisdictions ?? "";
      const jurisdictions = rawJurisdictions
        .split(/[\s,]+/)
        .map((j) => j.trim())
        .filter((j) => j.length > 0);
      const rawListing = req.query.listingStatus ?? "private";
      const fiscalYearEnd = req.query.fiscalYearEnd ?? "12-31";

      if (!VALID_LISTING_STATUSES.includes(rawListing)) {
        return {
          status: 400,
          body: meta(route, {
            message: `Unknown listingStatus "${rawListing}". Must be one of: ${VALID_LISTING_STATUSES.join(", ")}.`,
          }),
        };
      }

      const profile: CompanyProfile = {
        totalAnnualRevenueUSD: Number.isNaN(revenue) || revenue < 0 ? 0 : revenue,
        jurisdictions,
        listingStatus: rawListing as ListingStatus,
        fiscalYearEnd,
      };

      const results = evaluateApplicability(
        profile,
        caRegime.CALIFORNIA_OBLIGATIONS,
      );
      return ok(route, {
        results,
        applicableCount: results.filter((r) => r.applies).length,
        enforceableCount: results.filter((r) => r.enforceable).length,
      });
    }
    case "as-of": {
      const histories = caRegime.CALIFORNIA_STATUS_HISTORIES;

      // Collect boundary dates from all obligation histories for slider stops
      const validSet = new Set<string>();
      const knowledgeSet = new Set<string>();
      for (const { history } of histories) {
        for (const fact of history) {
          validSet.add(fact.validFrom);
          if (fact.validTo !== undefined) validSet.add(fact.validTo);
          knowledgeSet.add(fact.recordedAt);
        }
      }
      const validDates = [...validSet].sort();
      const knowledgeDates = [...knowledgeSet].sort();

      const validOn = req.query.validOn;
      const knownAsOf = req.query.knownAsOf;

      if (validOn === undefined || knownAsOf === undefined) {
        // Return available slider dates so the client can initialize
        return ok(route, { validDates, knowledgeDates });
      }

      const rows = histories.map((entry) => {
        const status = resolveValueAsOf(entry.history, { validOn, knownAsOf });
        return {
          obligationId: entry.obligationId,
          title: entry.title,
          regime: entry.regime,
          ...(status !== undefined ? { status } : {}),
        };
      });

      return ok(route, {
        rows,
        validDates,
        knowledgeDates,
        asOf: { validOn, knownAsOf },
      });
    }
    default:
      return { status: 404, body: meta(route, { message: "Unknown route." }) };
  }
}

function ok(route: Route, extra: Record<string, unknown>): ApiResult {
  return { status: 200, body: meta(route, extra) };
}

function meta(route: Route, extra: Record<string, unknown>): Record<string, unknown> {
  return { route, disclaimer: DISCLAIMER, ...extra };
}
