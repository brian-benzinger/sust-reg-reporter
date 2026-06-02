// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import { cleanup, render, screen, act } from "@testing-library/react";
import type { ObligationStatusHistory } from "@sust-reg/core";
import { AsOfSlider } from "../src/components/AsOfSlider.tsx";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

vi.mock("../src/api.ts", () => ({ fetchAsOf: vi.fn() }));

const { fetchAsOf } = await import("../src/api.ts");

const histories: ObligationStatusHistory[] = [
  {
    obligationId: "ob-a",
    title: "Obligation A",
    regime: "R1",
    history: [
      { value: "in-effect", validFrom: "2023-01-01", recordedAt: "2023-01-01" },
    ],
  },
];

describe("AsOfSlider (API integration)", () => {
  it("replaces local rows with API data when fetchAsOf resolves", async () => {
    vi.mocked(fetchAsOf).mockResolvedValue({
      validDates: ["2023-01-01"],
      knowledgeDates: ["2023-01-01"],
      rows: [
        {
          obligationId: "ob-a",
          title: "Obligation A",
          regime: "R1",
          status: "enforced",
        },
      ],
    });

    render(<AsOfSlider histories={histories} />);
    await act(async () => {
      await Promise.resolve();
    });

    // Local computation gives "In effect"; API says "Enforced" — API wins.
    expect(screen.getByText("Enforced")).toBeTruthy();
  });

  it("renders an em-dash for an API row with no status", async () => {
    vi.mocked(fetchAsOf).mockResolvedValue({
      validDates: ["2023-01-01"],
      knowledgeDates: ["2023-01-01"],
      rows: [
        { obligationId: "ob-a", title: "Obligation A", regime: "R1" },
      ],
    });

    render(<AsOfSlider histories={histories} />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText("—")).toBeTruthy();
  });

  it("falls back to local rows when fetchAsOf rejects", async () => {
    vi.mocked(fetchAsOf).mockRejectedValue(new Error("network error"));

    render(<AsOfSlider histories={histories} />);
    await act(async () => {
      await Promise.resolve();
    });

    // Falls back to local computation: "In effect" for 2023-01-01.
    expect(screen.getByText("In effect")).toBeTruthy();
  });

  it("keeps local rows when the API response has no rows field", async () => {
    // /api/as-of without date params returns only validDates/knowledgeDates
    vi.mocked(fetchAsOf).mockResolvedValue({
      validDates: ["2023-01-01"],
      knowledgeDates: ["2023-01-01"],
    });

    render(<AsOfSlider histories={histories} />);
    await act(async () => {
      await Promise.resolve();
    });

    // apiRows stays null → shows local computation
    expect(screen.getByText("In effect")).toBeTruthy();
  });
});
