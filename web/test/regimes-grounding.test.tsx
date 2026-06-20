// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import { cleanup, render, screen, act } from "@testing-library/react";
import type { Obligation } from "@sust-reg/core";
import { regimeGroups } from "../src/model.ts";
import { RegimesIsland } from "../src/components/RegimesIsland.tsx";
import { ObligationGroundingBadge } from "../src/components/ObligationGroundingBadge.tsx";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

vi.mock("../src/api.ts", () => ({ fetchGrounding: vi.fn() }));

const { fetchGrounding } = await import("../src/api.ts");

// Two seed-ungrounded obligations; the live fetch grounds only the first.
const obligations: Obligation[] = [
  {
    id: "ob-grounded",
    regime: "R1",
    title: "Grounded one",
    status: "in-effect",
    criteria: {},
    source: { label: "X", snapshotHash: "ungrounded:seed" },
  },
  {
    id: "ob-plain",
    regime: "R1",
    title: "Plain one",
    status: "in-effect",
    criteria: {},
    source: { label: "Y", snapshotHash: "ungrounded:seed" },
  },
];
const groups = regimeGroups(obligations);

const flush = () => act(async () => { await Promise.resolve(); });

describe("RegimesIsland (live grounding overlay, ADR-0028)", () => {
  it("upgrades the seed badge to grounded where the corpus has grounded it", async () => {
    vi.mocked(fetchGrounding).mockResolvedValue({
      groundings: [
        {
          obligationId: "ob-grounded",
          grounded: true,
          confidence: "high",
          snapshotHash: "sha256:x",
          retrievedAt: "2026-05-31",
        },
      ],
    });

    render(<RegimesIsland groups={groups} />);
    await flush();

    expect(screen.getByText("Grounded")).toBeTruthy();
    expect(screen.getByText("high")).toBeTruthy();
    // The ungrounded obligation keeps its seed badge.
    expect(screen.getByText("Ungrounded seed data")).toBeTruthy();
  });

  it("keeps the seed badges when the grounding fetch fails", async () => {
    vi.mocked(fetchGrounding).mockRejectedValue(new Error("network error"));

    render(<RegimesIsland groups={groups} />);
    await flush();

    expect(screen.getAllByText("Ungrounded seed data")).toHaveLength(2);
    expect(screen.queryByText("Grounded")).toBeNull();
  });

  it("defaults to the full v1 corpus when given no groups", async () => {
    vi.mocked(fetchGrounding).mockResolvedValue({ groundings: [] });

    render(<RegimesIsland />);
    await flush();

    // The default corpus renders the regimes index heading and real obligations.
    expect(screen.getByText("Regimes")).toBeTruthy();
    expect(
      screen.getByText("Climate-related financial risk report"),
    ).toBeTruthy();
  });
});

describe("ObligationGroundingBadge (live grounding overlay, ADR-0028)", () => {
  it("shows the live grounding for the obligation after the fetch", async () => {
    vi.mocked(fetchGrounding).mockResolvedValue({
      groundings: [
        {
          obligationId: "ob-grounded",
          grounded: true,
          confidence: "medium",
          snapshotHash: "sha256:x",
          retrievedAt: "2026-05-31",
        },
      ],
    });

    render(<ObligationGroundingBadge obligationId="ob-grounded" />);
    await flush();

    expect(screen.getByText("Grounded")).toBeTruthy();
    expect(screen.getByText("medium")).toBeTruthy();
  });

  it("shows the labelled substantiating quote and a definitions link for a span grounding (ADR-0035)", async () => {
    vi.mocked(fetchGrounding).mockResolvedValue({
      groundings: [
        {
          obligationId: "ob-grounded",
          grounded: true,
          method: "span",
          confidence: "high",
          snapshotHash: "sha256:x",
          retrievedAt: "2026-05-31",
          span: { start: 9559, end: 9627 },
          quote: "covered entity shall prepare a climate-related financial risk report",
        },
      ],
    });

    render(<ObligationGroundingBadge obligationId="ob-grounded" />);
    await flush();

    expect(screen.getByText("Grounded")).toBeTruthy();
    expect(screen.getByText("Source text")).toBeTruthy();
    expect(
      screen.getByText(
        "covered entity shall prepare a climate-related financial risk report",
      ),
    ).toBeTruthy();
    // The grounded badge links to the methodology definitions.
    const info = screen.getByRole("link", { name: /grounding and confidence mean/i });
    expect(info.getAttribute("href")).toBe("/methodology.html#grounding");
  });

  it("stays ungrounded for an obligation the corpus has not grounded", async () => {
    vi.mocked(fetchGrounding).mockResolvedValue({ groundings: [] });

    render(<ObligationGroundingBadge obligationId="ob-grounded" />);
    await flush();

    expect(screen.getByText("Ungrounded seed data")).toBeTruthy();
  });

  it("stays ungrounded on a fetch failure", async () => {
    vi.mocked(fetchGrounding).mockRejectedValue(new Error("network error"));

    render(<ObligationGroundingBadge obligationId="ob-grounded" />);
    await flush();

    expect(screen.getByText("Ungrounded seed data")).toBeTruthy();
  });
});
