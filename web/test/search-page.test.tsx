// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { SearchIsland, SearchPage } from "../src/components/SearchPage.tsx";
import type {
  SearchApiResult,
  SearchObligationHit,
  SearchSourceHit,
} from "../src/api.ts";

vi.mock("../src/api.ts", () => ({ fetchSearch: vi.fn() }));

// Import after mock so the component receives the mocked version.
const { fetchSearch } = await import("../src/api.ts");

afterEach(() => {
  cleanup();
  // mockClear (not just restoreAllMocks) so call counts don't leak across tests.
  vi.mocked(fetchSearch).mockClear();
});

const OBL: SearchObligationHit = {
  obligationId: "ca-sb261-climate-risk-report",
  regime: "CA-SB261",
  title: "Climate-related financial risk report",
  status: "stayed",
  sourceLabel: "California SB 261 (2023), § 38533",
  score: 12,
};
const SRC: SearchSourceHit = {
  key: "fedreg-2026-03157",
  name: "EPA GHG endangerment rescission",
  authority: "federal-register",
  url: "https://example.gov/fr",
  score: 5,
};

const result = (over: Partial<SearchApiResult> = {}): SearchApiResult => ({
  query: "climate",
  obligations: [],
  sources: [],
  total: 0,
  ...over,
});

const submit = (): void => {
  fireEvent.submit(screen.getByRole("search"));
};

describe("SearchIsland", () => {
  it("renders the empty form with example chips and no results initially", () => {
    render(<SearchIsland />);
    expect(screen.getByRole("searchbox")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Search" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "scope 3" })).toBeTruthy();
    expect(screen.queryByText(/Obligations \(/)).toBeNull();
  });

  it("searches on submit and renders obligation + source hits", async () => {
    vi.mocked(fetchSearch).mockResolvedValue(
      result({ obligations: [OBL], sources: [SRC], total: 2 }),
    );
    render(<SearchIsland />);
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "climate" },
    });
    submit();

    const link = await screen.findByText(
      "Climate-related financial risk report",
    );
    expect(link.closest("a")?.getAttribute("href")).toBe(
      "/regimes/ca-sb261-climate-risk-report.html",
    );
    expect(screen.getByText("Obligations (1)")).toBeTruthy();
    expect(screen.getByText("Sources (1)")).toBeTruthy();
    expect(
      screen
        .getByText("EPA GHG endangerment rescission")
        .closest("a")
        ?.getAttribute("href"),
    ).toBe("https://example.gov/fr");
    expect(fetchSearch).toHaveBeenCalledWith("climate");
  });

  it("searches from an example chip and omits the empty sources section", async () => {
    vi.mocked(fetchSearch).mockResolvedValue(
      result({ obligations: [OBL], total: 1 }),
    );
    render(<SearchIsland />);
    fireEvent.click(screen.getByRole("button", { name: "scope 3" }));
    await screen.findByText("Obligations (1)");
    expect(fetchSearch).toHaveBeenCalledWith("scope 3");
    expect(screen.queryByText(/Sources \(/)).toBeNull();
  });

  it("shows only the sources section when no obligations match", async () => {
    vi.mocked(fetchSearch).mockResolvedValue(
      result({ sources: [SRC], total: 1 }),
    );
    render(<SearchIsland />);
    fireEvent.click(screen.getByRole("button", { name: "California" }));
    await screen.findByText("Sources (1)");
    expect(screen.queryByText(/Obligations \(/)).toBeNull();
  });

  it("shows an honest empty state when nothing matches", async () => {
    vi.mocked(fetchSearch).mockResolvedValue(result({ total: 0 }));
    render(<SearchIsland />);
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "zzz" },
    });
    submit();
    await screen.findByText(/No matches for/);
  });

  it("clears results on a blank query without fetching", async () => {
    vi.mocked(fetchSearch).mockResolvedValue(
      result({ obligations: [OBL], total: 1 }),
    );
    render(<SearchIsland />);
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "climate" },
    });
    submit();
    await screen.findByText("Obligations (1)");

    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "   " },
    });
    submit();
    expect(screen.queryByText("Obligations (1)")).toBeNull();
    expect(fetchSearch).toHaveBeenCalledTimes(1); // the blank submit did not fetch
  });

  it("shows an error when the search fails", async () => {
    vi.mocked(fetchSearch).mockRejectedValue(new Error("network down"));
    render(<SearchIsland />);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "x" } });
    submit();
    await screen.findByText(/Could not run search/);
  });

  it("SearchPage renders the heading, scope note, and the island", () => {
    render(<SearchPage />);
    expect(screen.getByText("Search the corpus")).toBeTruthy();
    expect(screen.getByText(/not the full regulation text/)).toBeTruthy();
    expect(screen.getByRole("searchbox")).toBeTruthy();
  });
});
