// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import { cleanup, render, screen, act, fireEvent } from "@testing-library/react";
import { DiffsIsland, DiffsPage } from "../src/components/DiffsPage.tsx";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

vi.mock("../src/api.ts", () => ({ fetchDiffs: vi.fn(), fetchDiff: vi.fn() }));

const { fetchDiffs, fetchDiff } = await import("../src/api.ts");

const flush = () => act(async () => { await Promise.resolve(); });
const detail = (changes: unknown[]) => ({
  ...DIFF,
  fromHash: "sha256:a",
  toHash: "sha256:b",
  schemaVersion: "1.0.0",
  modelId: "claude",
  promptVersion: "0",
  changes,
});

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

  it("expands a row to show per-change detail with before/after text", async () => {
    vi.mocked(fetchDiffs).mockResolvedValue({ diffs: [DIFF] });
    vi.mocked(fetchDiff).mockResolvedValue(
      detail([
        {
          type: "modification",
          classification: "substantive",
          textA: "over $1B",
          textB: "over $500M",
          confidence: 1,
          needsReview: true,
          description: "threshold lowered",
        },
        {
          type: "insertion",
          classification: "cosmetic",
          textA: "",
          textB: "A new heading.",
          confidence: 1,
          needsReview: false,
        },
      ]) as never,
    );
    render(<DiffsIsland />);
    await flush();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "View" }));
      await Promise.resolve();
    });
    expect(screen.getByText("threshold lowered")).toBeTruthy();
    expect(screen.getByText("over $1B")).toBeTruthy();
    expect(screen.getByText("over $500M")).toBeTruthy();
    expect(screen.getByText("A new heading.")).toBeTruthy();
    expect(screen.getByText("substantive")).toBeTruthy();
    expect(screen.getByText("cosmetic")).toBeTruthy();
    expect(screen.getByText("needs review")).toBeTruthy();
    // Clicking again collapses it.
    fireEvent.click(screen.getByRole("button", { name: "Hide" }));
    expect(screen.queryByText("threshold lowered")).toBeNull();
  });

  it("shows a message when an expanded diff has no individual changes", async () => {
    vi.mocked(fetchDiffs).mockResolvedValue({ diffs: [DIFF] });
    vi.mocked(fetchDiff).mockResolvedValue(detail([]) as never);
    render(<DiffsIsland />);
    await flush();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "View" }));
      await Promise.resolve();
    });
    expect(screen.getByText(/No individual changes recorded/)).toBeTruthy();
  });

  it("shows a detail error when fetchDiff rejects", async () => {
    vi.mocked(fetchDiffs).mockResolvedValue({ diffs: [DIFF] });
    vi.mocked(fetchDiff).mockRejectedValue(new Error("nope"));
    render(<DiffsIsland />);
    await flush();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "View" }));
      await Promise.resolve();
    });
    expect(screen.getByText(/Could not load the change detail/)).toBeTruthy();
  });

  it("shows a detail loading state while fetchDiff is in flight", async () => {
    vi.mocked(fetchDiffs).mockResolvedValue({ diffs: [DIFF] });
    vi.mocked(fetchDiff).mockReturnValue(new Promise(() => {}) as never);
    render(<DiffsIsland />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "View" }));
    expect(screen.getByText(/Loading changes/)).toBeTruthy();
  });
});
