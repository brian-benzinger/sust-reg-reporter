/**
 * Typed client for the thin interactive API (ADR-0013, ADR-0023).
 *
 * All functions are browser-only (they call `fetch`). They are invoked from
 * `useEffect` hooks — never during prerendering — so the `location` global and
 * `fetch` are always available when these run.
 *
 * Base path is `/api`, relative to the page origin, so CloudFront routes both
 * the static site and the API Gateway origin without any hardcoded URL.
 */
import type { ApplicabilityResult, RegulationStatus } from "@sust-reg/core";

const API_BASE = "/api";

async function getJson<T>(path: string, params?: Record<string, string>): Promise<T> {
  const serialized = params !== undefined ? new URLSearchParams(params).toString() : "";
  const qs = serialized.length > 0 ? `?${serialized}` : "";
  const res = await fetch(`${API_BASE}${path}${qs}`);
  if (!res.ok) {
    throw new Error(`${API_BASE}${path} returned HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// /scope-check
// ---------------------------------------------------------------------------

export interface ScopeCheckParams {
  readonly revenue: string;
  readonly jurisdictions: string;
  readonly listingStatus: string;
  readonly fiscalYearEnd: string;
}

export interface ScopeCheckApiResult {
  readonly results: readonly ApplicabilityResult[];
  readonly applicableCount: number;
  readonly enforceableCount: number;
}

export async function fetchScopeCheck(
  params: ScopeCheckParams,
): Promise<ScopeCheckApiResult> {
  return getJson<ScopeCheckApiResult>("/scope-check", {
    revenue: params.revenue,
    jurisdictions: params.jurisdictions,
    listingStatus: params.listingStatus,
    fiscalYearEnd: params.fiscalYearEnd,
  });
}

// ---------------------------------------------------------------------------
// /as-of
// ---------------------------------------------------------------------------

export interface AsOfApiRow {
  readonly obligationId: string;
  readonly title: string;
  readonly regime: string;
  readonly status?: RegulationStatus;
}

export interface AsOfApiResult {
  readonly validDates: readonly string[];
  readonly knowledgeDates: readonly string[];
  readonly rows?: readonly AsOfApiRow[];
  readonly asOf?: { readonly validOn: string; readonly knownAsOf: string };
}

/** Fetch available slider dates and, optionally, resolved rows for a date pair. */
export async function fetchAsOf(
  validOn?: string,
  knownAsOf?: string,
): Promise<AsOfApiResult> {
  const params: Record<string, string> = {};
  if (validOn !== undefined) params["validOn"] = validOn;
  if (knownAsOf !== undefined) params["knownAsOf"] = knownAsOf;
  return getJson<AsOfApiResult>("/as-of", params);
}

// ---------------------------------------------------------------------------
// /sources
// ---------------------------------------------------------------------------

export interface SourceSummary {
  readonly key: string;
  readonly name: string;
  readonly authority: string;
  readonly versions: number;
  readonly latestRecordedAt: string | null;
}

export interface SourcesApiResult {
  readonly sources: readonly SourceSummary[];
}

export async function fetchSources(): Promise<SourcesApiResult> {
  return getJson<SourcesApiResult>("/sources");
}

// ---------------------------------------------------------------------------
// /diff
// ---------------------------------------------------------------------------

export interface DiffSummary {
  readonly id: string;
  readonly sourceKey: string;
  readonly fromVersionId: string | null;
  readonly toVersionId: string;
  readonly substantive: number;
  readonly cosmetic: number;
  readonly needsReview: number;
  readonly engineVersion: string;
  readonly createdAt: string;
}

export interface DiffsApiResult {
  readonly diffs: readonly DiffSummary[];
}

export async function fetchDiffs(sourceKey?: string): Promise<DiffsApiResult> {
  const params: Record<string, string> = {};
  if (sourceKey !== undefined) params["source"] = sourceKey;
  return getJson<DiffsApiResult>("/diff", params);
}
