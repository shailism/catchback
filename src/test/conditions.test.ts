import { describe, expect, it } from "vitest";
import { calmestWindow, parseSavedLocation, coarse, type HourCondition } from "@/lib/conditions";

const h = (time: string, wind: number, wave: number | null = 0.3): HourCondition => ({ time, temp: 20, wind, direction: 0, code: 0, wave });

describe("conditions", () => {
  it("rejects typed or invalid saved locations", () => {
    expect(parseSavedLocation(null)).toBeNull();
    expect(parseSavedLocation('"Cape Greco"')).toBeNull();
    expect(parseSavedLocation('{"lat":100,"lng":1}')).toBeNull();
    expect(parseSavedLocation('{"lat":34.96,"lng":34.07,"savedAt":1}')).toEqual({ lat: 34.96, lng: 34.07, savedAt: 1 });
  });
  it("rounds coordinates before sending", () => expect(coarse(34.96321)).toBe(34.96));
  it("picks the calmest daylight 3-hour stretch from now, ignoring night", () => {
    const hours = [h("2026-11-08T03:00", 0), h("2026-11-08T04:00", 0), h("2026-11-08T05:00", 0),
      h("2026-11-08T07:00", 20), h("2026-11-08T08:00", 6), h("2026-11-08T09:00", 5), h("2026-11-08T10:00", 7), h("2026-11-08T11:00", 18)];
    const w = calmestWindow(hours, "2026-11-08T02:15", [{ start: "2026-11-08T06:30", end: "2026-11-08T17:00" }]);
    expect(w).toEqual({ day: "2026-11-08", start: "08:00", end: "11:00", avgWind: 6, maxWave: 0.3 });
  });
  it("returns no window when no daylight hours remain", () => {
    expect(calmestWindow([h("2026-11-08T20:00", 1)], "2026-11-08T19:00", [{ start: "2026-11-08T06:30", end: "2026-11-08T17:00" }])).toBeNull();
  });
});
