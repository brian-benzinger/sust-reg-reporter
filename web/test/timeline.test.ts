import { describe, it, expect } from "vitest";
import type { ObligationStatusHistory } from "@sust-reg/core";
import { collectDates, resolveRows } from "../src/timeline.ts";

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
      // Ends before A's latest valid boundary → unresolved at later valid dates.
      { value: "in-effect", validFrom: "2023-03-01", validTo: "2023-09-01", recordedAt: "2023-03-01" },
    ],
  },
];

describe("collectDates", () => {
  it("gathers distinct, sorted valid and knowledge boundary dates", () => {
    const { validDates, knowledgeDates } = collectDates(histories);
    expect(validDates).toEqual([
      "2023-01-01",
      "2023-03-01",
      "2023-09-01",
      "2024-01-01",
      "2024-06-01",
    ]);
    expect(knowledgeDates).toEqual([
      "2023-01-01",
      "2023-03-01",
      "2024-01-01",
      "2025-01-01",
    ]);
  });

  it("returns empty arrays for empty input", () => {
    expect(collectDates([])).toEqual({ validDates: [], knowledgeDates: [] });
  });
});

describe("resolveRows", () => {
  it("resolves each obligation's status for the query", () => {
    const rows = resolveRows(histories, {
      validOn: "2024-09-01",
      knownAsOf: "2024-12-31",
    });
    // A: correction not yet known → in-effect. B: outside its valid range → —.
    expect(rows[0]).toMatchObject({ status: "in-effect", label: "In effect" });
    expect(rows[1]?.status).toBeUndefined();
    expect(rows[1]?.label).toBe("—");
  });

  it("applies a later correction once it is known", () => {
    const rows = resolveRows(histories, {
      validOn: "2024-09-01",
      knownAsOf: "2025-06-01",
    });
    expect(rows[0]).toMatchObject({ status: "stayed", label: "Stayed" });
  });
});
