// @vitest-environment jsdom
import { afterEach, describe, it, expect } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ObligationStatusHistory } from "@sust-reg/core";
import { AsOfSlider } from "../src/components/AsOfSlider.tsx";

afterEach(cleanup);

const histories: ObligationStatusHistory[] = [
  {
    obligationId: "ob-a",
    title: "Obligation A",
    regime: "R1",
    history: [
      { value: "proposed", validFrom: "2023-01-01", validTo: "2024-01-01", recordedAt: "2023-01-01" },
      { value: "in-effect", validFrom: "2024-01-01", recordedAt: "2024-01-01" },
      { value: "stayed", validFrom: "2024-06-01", recordedAt: "2025-01-01" },
    ],
  },
  {
    obligationId: "ob-b",
    title: "Obligation B",
    regime: "R2",
    history: [
      { value: "in-effect", validFrom: "2023-03-01", validTo: "2023-09-01", recordedAt: "2023-03-01" },
    ],
  },
];

describe("AsOfSlider (interactive)", () => {
  it("renders the latest-known status by default, with unresolved rows as a dash", () => {
    render(<AsOfSlider histories={histories} />);
    // Default valid date 2024-06-01, latest knowledge 2025-01-01 → A is stayed.
    expect(screen.getByText("Stayed")).toBeTruthy();
    // B is outside its valid range at that date → n/a.
    expect(screen.getByText("n/a")).toBeTruthy();
  });

  it("hides a later correction when the knowledge date is rolled back", () => {
    render(<AsOfSlider histories={histories} />);
    const sliders = screen.getAllByRole("slider");
    // knowledge slider (second) → index 2 = 2024-01-01, before the 2025 stay.
    fireEvent.change(sliders[1] as HTMLInputElement, { target: { value: "2" } });
    expect(screen.getByText("In effect")).toBeTruthy();
  });

  it("reflects the valid-time date when that slider moves", () => {
    render(<AsOfSlider histories={histories} />);
    const sliders = screen.getAllByRole("slider");
    // valid slider (first) → index 0 = 2023-01-01 → A is proposed.
    fireEvent.change(sliders[0] as HTMLInputElement, { target: { value: "0" } });
    expect(screen.getByText("Proposed")).toBeTruthy();
  });

  it("shows a fallback when there is no timeline data", () => {
    render(<AsOfSlider histories={[]} />);
    expect(screen.getByText("No timeline data available.")).toBeTruthy();
  });
});
