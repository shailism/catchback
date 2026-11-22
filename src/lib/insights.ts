import type { Catch, Trip } from "./db";

type InsightRecord = Pick<Catch, "date" | "species" | "bait" | "technique" | "weightKg" | "lengthCm">;
export type CountGroup = { key: string; label: string; count: number };

function breakdown(records: readonly InsightRecord[], field: "species" | "bait" | "technique") {
  const groups = new Map<string, CountGroup>();
  for (const record of records) {
    const label = record[field]?.trim().replace(/\s+/g, " ") ?? "";
    const key = label ? `named:${label.toLowerCase()}` : "missing";
    const group = groups.get(key);
    if (group) group.count++;
    else groups.set(key, { key, label: label || "Not recorded", count: 1 });
  }
  return [...groups.values()].sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

function measurement(records: readonly InsightRecord[], field: "weightKg" | "lengthCm") {
  let count = 0;
  let largest: number | null = null;
  for (const record of records) {
    const value = record[field];
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) continue;
    count++;
    largest = largest === null ? value : Math.max(largest, value);
  }
  return { count, largest };
}

/** Read-only summaries of saved records, never an estimate of trips or effort. */
export function aggregateInsights(records: readonly InsightRecord[]) {
  const species = breakdown(records, "species");
  return {
    records: records.length,
    namedSpecies: species.filter(group => group.key !== "missing").length,
    catchDates: new Set(records.map(record => record.date)).size,
    species,
    bait: breakdown(records, "bait"),
    technique: breakdown(records, "technique"),
    weight: measurement(records, "weightKg"),
    length: measurement(records, "lengthCm"),
  };
}

/** Only explicitly logged trips, independent of catch-photo records. */
export function aggregateTrips(trips: readonly Pick<Trip, "outcome" | "durationMinutes">[]) {
  return {
    total: trips.length,
    withCatches: trips.filter(t => t.outcome === "caught").length,
    withoutCatches: trips.filter(t => t.outcome === "none").length,
    durationSamples: trips.filter(t => typeof t.durationMinutes === "number" && Number.isFinite(t.durationMinutes) && t.durationMinutes > 0).length,
  };
}