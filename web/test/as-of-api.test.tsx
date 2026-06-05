// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import { cleanup, render, screen, act } from "@testing-library/react";
import type { ObligationStatusHistory } from "@sust-reg/core";
import { AsOfSlider } from "../src/components/AsOfSlider.tsx";
import type { AsOfApiResult } from "../src/api.ts";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
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

  it("renders n/a for an API row with no status", async () => {
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

    expect(screen.getByText("n/a")).toBeTruthy();
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

  it("renders the grounded badge and confidence from API provenance (ADR-0028)", async () => {
    vi.mocked(fetchAsOf).mockResolvedValue({
      validDates: ["2023-01-01"],
      knowledgeDates: ["2023-01-01"],
      rows: [
        {
          obligationId: "ob-a",
          title: "Obligation A",
          regime: "R1",
          status: "in-effect",
          grounded: true,
          confidence: "high",
          snapshotHash: "sha256:abc",
          retrievedAt: "2026-05-31",
        },
      ],
    });

    render(<AsOfSlider histories={histories} />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText("Grounded")).toBeTruthy();
    expect(screen.getByText("high")).toBeTruthy();
  });

  it("marks an API row ungrounded when grounded is false", async () => {
    vi.mocked(fetchAsOf).mockResolvedValue({
      validDates: ["2023-01-01"],
      knowledgeDates: ["2023-01-01"],
      rows: [
        {
          obligationId: "ob-a",
          title: "Obligation A",
          regime: "R1",
          status: "in-effect",
          grounded: false,
        },
      ],
    });

    render(<AsOfSlider histories={histories} />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText("Ungrounded seed data")).toBeTruthy();
  });

  it("debounces the loading indicator — no flash on a fast response", async () => {
    vi.useFakeTimers();
    let resolveFetch!: (v: AsOfApiResult) => void;
    vi.mocked(fetchAsOf).mockReturnValue(
      new Promise((r) => {
        resolveFetch = r;
      }) as ReturnType<typeof fetchAsOf>,
    );

    render(<AsOfSlider histories={histories} />);

    // Before the debounce delay, with the fetch in flight, no indicator shows.
    expect(screen.queryByText("Updating…")).toBeNull();

    // Past the delay and still pending → the indicator appears.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(screen.getByText("Updating…")).toBeTruthy();

    // Resolving clears the indicator and updates the rows in place.
    await act(async () => {
      resolveFetch({
        validDates: ["2023-01-01"],
        knowledgeDates: ["2023-01-01"],
        rows: [
          { obligationId: "ob-a", title: "Obligation A", regime: "R1", status: "enforced" },
        ],
      });
      await Promise.resolve();
    });
    expect(screen.queryByText("Updating…")).toBeNull();
    expect(screen.getByText("Enforced")).toBeTruthy();
  });

  it("ignores a response that arrives after the component moved on", async () => {
    let resolveFirst!: (v: AsOfApiResult) => void;
    vi.mocked(fetchAsOf).mockReturnValueOnce(
      new Promise((r) => {
        resolveFirst = r;
      }) as ReturnType<typeof fetchAsOf>,
    );

    const view = render(<AsOfSlider histories={histories} />);
    // Tear down so the in-flight fetch's cleanup marks it inactive.
    view.unmount();

    // Resolving now hits the inactive guard: no state update, no throw.
    await act(async () => {
      resolveFirst({ validDates: ["2023-01-01"], knowledgeDates: ["2023-01-01"], rows: [] });
      await Promise.resolve();
    });
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
