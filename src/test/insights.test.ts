import { describe, expect, it } from "vitest";
import { aggregateInsights } from "@/lib/insights";

describe("Free catch Insights", () => {
  it("keeps empty measurements unavailable, not zero", () => {
    const result = aggregateInsights([]);
    expect(result).toMatchObject({ records: 0, namedSpecies: 0, catchDates: 0, species: [], bait: [], technique: [], weight: { count: 0, largest: null }, length: { count: 0, largest: null } });
  });
  it("counts missing and blank fields explicitly without inventing a named species", () => {
    const result = aggregateInsights([{ date: "2026-10-01", species: "  " }]);
    expect(result.namedSpecies).toBe(0);
    for (const groups of [result.species, result.bait, result.technique]) expect(groups).toEqual([{ key: "missing", label: "Not recorded", count: 1 }]);
  });
  it("groups whitespace and case without changing stored values", () => {
    const records = [{ date: "2026-10-01", species: " Sea  Bass ", bait: " Shrimp ", technique: " Float  fishing " }, { date: "2026-10-02", species: "sea\tbass", bait: "SHRIMP", technique: "float fishing" }];
    const original = JSON.stringify(records);
    const result = aggregateInsights(records);
    expect(result.namedSpecies).toBe(1);
    expect(result.species).toEqual([{ key: "named:sea bass", label: "Sea Bass", count: 2 }]);
    expect(result.bait[0]?.count).toBe(2);
    expect(result.technique[0]?.count).toBe(2);
    expect(JSON.stringify(records)).toBe(original);
  });
  it("counts record dates, not inferred trips or effort", () => {
    const result = aggregateInsights([{ date: "2026-10-01", species: "Bass" }, { date: "2026-10-01", species: "Bream" }, { date: "2026-10-03", species: "" }]);
    expect(result.records).toBe(3);
    expect(result.catchDates).toBe(2);
    expect(result.namedSpecies).toBe(2);
  });
  it("counts weight and length samples independently, excluding invalid measurements", () => {
    const result = aggregateInsights([
      { date: "2026-10-01", species: "", weightKg: 2.5 },
      { date: "2026-10-01", species: "", weightKg: 1.2, lengthCm: 45.5 },
      { date: "2026-10-02", species: "", weightKg: 0, lengthCm: -2 },
      { date: "2026-10-02", species: "", weightKg: NaN, lengthCm: Infinity },
      { date: "2026-10-02", species: "" },
    ]);
    expect(result.weight).toEqual({ count: 2, largest: 2.5 });
    expect(result.length).toEqual({ count: 1, largest: 45.5 });
  });
});