// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import type { Obligation } from "@sust-reg/core";
import { ScopeChecker } from "../src/components/ScopeChecker.tsx";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

vi.mock("../src/api.ts", () => ({ fetchScopeCheck: vi.fn() }));

const { fetchScopeCheck } = await import("../src/api.ts");

const corpus: Obligation[] = [
  {
    id: "ob-applies",
    regime: "TEST",
    title: "Obligation That Applies",
    status: "in-effect",
    criteria: { minTotalAnnualRevenueUSD: 100 },
    source: { label: "test", snapshotHash: "sha256:x" },
  },
];

describe("ScopeChecker (API integration)", () => {
  it("calls fetchScopeCheck after the debounce and shows the API result", async () => {
    vi.mocked(fetchScopeCheck).mockResolvedValue({
      results: [],
      applicableCount: 0,
      enforceableCount: 0,
    });

    render(<ScopeChecker obligations={corpus} />);

    // Wait for the 400 ms debounce + API round-trip to complete.
    await waitFor(
      () => expect(fetchScopeCheck).toHaveBeenCalled(),
      { timeout: 1500 },
    );

    // API returned empty results → "0 of 0"
    expect(screen.getByText(/0 of 0/, { exact: false })).toBeTruthy();
  });

  it("falls back to local view when fetchScopeCheck rejects", async () => {
    vi.mocked(fetchScopeCheck).mockRejectedValue(new Error("network error"));

    render(<ScopeChecker obligations={corpus} />);

    await waitFor(
      () => expect(fetchScopeCheck).toHaveBeenCalled(),
      { timeout: 1500 },
    );

    // apiView was cleared on rejection → localView is shown (1 of 1)
    expect(screen.getByText(/1 of 1/, { exact: false })).toBeTruthy();
  });
});
