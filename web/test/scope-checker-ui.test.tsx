// @vitest-environment jsdom
import { afterEach, describe, it, expect } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { Obligation } from "@sust-reg/core";
import { ScopeChecker } from "../src/components/ScopeChecker.tsx";

afterEach(cleanup);

const mk = (id: string, over: Partial<Obligation>): Obligation => ({
  id,
  regime: "TEST",
  title: id,
  status: "in-effect",
  criteria: {},
  source: { label: id, snapshotHash: "sha256:x" },
  ...over,
});

const corpus: Obligation[] = [
  mk("enforced-applies", {
    status: "enforced",
    criteria: { minTotalAnnualRevenueUSD: 100 },
  }),
  mk("ineffect-applies", {
    status: "in-effect",
    criteria: { minTotalAnnualRevenueUSD: 100 },
  }),
  mk("never-applies", { criteria: { minTotalAnnualRevenueUSD: 1_000_000_000_000 } }),
];

describe("ScopeChecker (interactive)", () => {
  it("renders verdicts, the enforced state, and a live summary", () => {
    render(<ScopeChecker obligations={corpus} />);

    expect(
      screen.getByText("2 of 3 obligation(s) apply; 1 currently enforced.", {
        exact: false,
      }),
    ).toBeTruthy();
    expect(screen.getAllByText("Applies").length).toBe(2);
    expect(screen.getByText("Does not apply")).toBeTruthy();
    expect(screen.getByText(/enforcement active/)).toBeTruthy();
  });

  it("recomputes when any input changes and ignores native submit", () => {
    const { container } = render(<ScopeChecker obligations={corpus} />);

    // Every field's onChange is wired.
    fireEvent.change(screen.getByLabelText(/Jurisdictions/), {
      target: { value: "US-CA US" },
    });
    fireEvent.change(screen.getByLabelText(/Listing status/), {
      target: { value: "public-eu" },
    });

    // Submitting the form must not navigate/reload (preventDefault).
    const form = container.querySelector("form.scope") as HTMLFormElement;
    fireEvent.submit(form);

    // Drop below every threshold → nothing applies.
    fireEvent.change(screen.getByLabelText(/Total annual revenue/), {
      target: { value: "10" },
    });
    expect(
      screen.getByText("0 of 3 obligation(s) apply", { exact: false }),
    ).toBeTruthy();
  });

  it("surfaces validation errors from a malformed field", () => {
    render(<ScopeChecker obligations={corpus} />);
    expect(screen.queryByRole("alert")).toBeNull();

    fireEvent.change(screen.getByLabelText(/Fiscal year end/), {
      target: { value: "nope" },
    });
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("MM-DD");
  });
});
