// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import { cleanup, render, screen, act } from "@testing-library/react";
import { SourcesIsland, SourcesPage } from "../src/components/SourcesPage.tsx";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

vi.mock("../src/api.ts", () => ({ fetchSources: vi.fn() }));

// Import after mock so the component receives the mocked version.
const { fetchSources } = await import("../src/api.ts");

describe("SourcesIsland", () => {
  it("shows a loading state before the API responds", () => {
    vi.mocked(fetchSources).mockReturnValue(new Promise(() => {}));
    render(<SourcesIsland />);
    expect(screen.getByText(/Loading tracked sources/)).toBeTruthy();
  });

  it("renders source rows from the API response", async () => {
    vi.mocked(fetchSources).mockResolvedValue({
      sources: [
        {
          key: "fedreg-001",
          name: "EPA Endangerment Rule",
          authority: "federal-register",
          versions: 3,
          latestRecordedAt: "2026-05-31T00:00:00Z",
        },
      ],
    });
    render(<SourcesIsland />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText("EPA Endangerment Rule")).toBeTruthy();
    expect(screen.getByText("federal-register")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
    expect(screen.getByText("2026-05-31T00:00:00Z")).toBeTruthy();
  });

  it("renders a dash when latestRecordedAt is null", async () => {
    vi.mocked(fetchSources).mockResolvedValue({
      sources: [
        {
          key: "x",
          name: "Unscheduled Source",
          authority: "manual",
          versions: 0,
          latestRecordedAt: null,
        },
      ],
    });
    render(<SourcesIsland />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText("—")).toBeTruthy();
  });

  it("shows an error message when fetchSources rejects", async () => {
    vi.mocked(fetchSources).mockRejectedValue(new Error("network timeout"));
    render(<SourcesIsland />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText(/Could not load sources/)).toBeTruthy();
  });

  it("shows an empty-corpus message when no sources exist", async () => {
    vi.mocked(fetchSources).mockResolvedValue({ sources: [] });
    render(<SourcesIsland />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText(/No tracked sources found/)).toBeTruthy();
  });

  it("SourcesPage renders the page heading and the island", async () => {
    vi.mocked(fetchSources).mockResolvedValue({ sources: [] });
    render(<SourcesPage />);
    expect(screen.getByText("Tracked sources")).toBeTruthy();
    await act(async () => {
      await Promise.resolve();
    });
  });
});
