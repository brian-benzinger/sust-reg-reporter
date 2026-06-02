// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import { cleanup, render, screen, act } from "@testing-library/react";
import { DiffsIsland, DiffsPage } from "../src/components/DiffsPage.tsx";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

vi.mock("../src/api.ts", () => ({ fetchDiffs: vi.fn() }));

const { fetchDiffs } = await import("../src/api.ts");

const DIFF = {
  id: "abc-123",
  sourceKey: "fedreg-2026-03157",
  fromVersionId: "v1",
  toVersionId: "v2",
  substantive: 2,
  cosmetic: 1,
  needsReview: 0,
  engineVersion: "0.1.0",
  createdAt: "2026-05-31T12:00:00Z",
};

describe("DiffsIsland", () => {
  it("shows a loading state before the API responds", () => {
    vi.mocked(fetchDiffs).mockReturnValue(new Promise(() => {}));
    render(<DiffsIsland />);
    expect(screen.getByText(/Loading change history/)).toBeTruthy();
  });

  it("renders diff rows from the API response", async () => {
    vi.mocked(fetchDiffs).mockResolvedValue({ diffs: [DIFF] });
    render(<DiffsIsland />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText("fedreg-2026-03157")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.getByText("1")).toBeTruthy();
    expect(screen.getByText("0")).toBeTruthy();
    // createdAt is formatted as a locale date string
    const formatted = new Date("2026-05-31T12:00:00Z").toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
    expect(screen.getByText(formatted)).toBeTruthy();
  });

  it("shows an error message when fetchDiffs rejects", async () => {
    vi.mocked(fetchDiffs).mockRejectedValue(new Error("API down"));
    render(<DiffsIsland />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText(/Could not load change history/)).toBeTruthy();
  });

  it("shows an empty-corpus message when no diffs exist", async () => {
    vi.mocked(fetchDiffs).mockResolvedValue({ diffs: [] });
    render(<DiffsIsland />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText(/No changes recorded yet/)).toBeTruthy();
  });

  it("DiffsPage renders the page heading and the island", async () => {
    vi.mocked(fetchDiffs).mockResolvedValue({ diffs: [] });
    render(<DiffsPage />);
    expect(screen.getByText("Change history")).toBeTruthy();
    await act(async () => {
      await Promise.resolve();
    });
  });
});
