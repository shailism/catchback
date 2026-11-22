import { describe, expect, it } from "vitest";
import {
  anniversaryIn, DEFAULT_PREFS, DEFAULT_SETTINGS, DEFAULT_TIME, loadSettings, migrateSettings,
  saveSettings, toIso, upcomingReminders, type ReminderSettings,
} from "@/lib/reminders";

const today = new Date(2026, 9, 29); // 29 Oct 2026
const settings = (patch: Partial<ReminderSettings> = {}): ReminderSettings => ({ ...DEFAULT_SETTINGS, ...patch });

describe("annual reminders", () => {
  it("defaults are 7 days, 3 days and on the day at 09:00, with the master switch on", () => {
    expect(DEFAULT_PREFS.map((p) => p.daysBefore)).toEqual([7, 3, 0]);
    expect(DEFAULT_PREFS.every((p) => p.time === "09:00" && p.enabled)).toBe(true);
    expect(DEFAULT_SETTINGS.master).toBe(true);
    expect(DEFAULT_SETTINGS.mutedCatchIds).toEqual([]);
  });
  it("schedules 7, 3 and 0 days before the anniversary", () => {
    const r = upcomingReminders([{ id: "a", date: "2024-11-10" }], settings(), today);
    expect(r.map((x) => toIso(x.remindOn))).toEqual(["2026-11-03", "2026-11-07", "2026-11-10"]);
    expect(r[0]?.yearsAgo).toBe(2);
  });
  it("uses each reminder's chosen local time", () => {
    const prefs = [
      { id: "x", daysBefore: 2, time: "06:30", enabled: true },
      { id: "y", daysBefore: 2, time: "18:45", enabled: true },
    ];
    const r = upcomingReminders([{ id: "a", date: "2024-11-10" }], settings({ prefs }), today);
    expect(r.map((x) => `${toIso(x.remindOn)} ${x.remindOn.toTimeString().slice(0, 5)}`)).toEqual(["2026-11-08 06:30", "2026-11-08 18:45"]);
  });
  it("supports any day count from 0 to 30, including on the anniversary", () => {
    const prefs = [
      { id: "x", daysBefore: 0, time: "09:00", enabled: true },
      { id: "y", daysBefore: 30, time: "09:00", enabled: true },
    ];
    const r = upcomingReminders([{ id: "a", date: "2024-11-10" }], settings({ prefs }), new Date(2026, 9, 1));
    expect(r.map((x) => toIso(x.remindOn))).toEqual(["2026-10-11", "2026-11-10"]);
    expect(r[1]?.label).toBe("On the anniversary");
  });
  it("an empty reminder list produces no reminders", () => {
    expect(upcomingReminders([{ id: "a", date: "2024-11-10" }], settings({ prefs: [] }), today)).toEqual([]);
  });
  it("skips disabled reminders and honours adjusted days", () => {
    const prefs = DEFAULT_PREFS.map((p) => (p.id === "three" ? { ...p, enabled: false } : p.id === "week" ? { ...p, daysBefore: 10 } : p));
    const r = upcomingReminders([{ id: "a", date: "2024-11-10" }], settings({ prefs }), today);
    expect(r.map((x) => toIso(x.remindOn))).toEqual(["2026-10-31", "2026-11-10"]);
  });
  it("no reminder for a catch from this year before its first anniversary", () => {
    expect(upcomingReminders([{ id: "a", date: "2026-11-05" }], settings(), today)).toEqual([]);
  });
  it("the master switch silences every reminder", () => {
    expect(upcomingReminders([{ id: "a", date: "2024-11-10" }], settings({ master: false }), today)).toEqual([]);
  });
  it("a muted catch produces no reminders while others still do", () => {
    const r = upcomingReminders(
      [{ id: "a", date: "2024-11-10" }, { id: "b", date: "2023-11-02" }],
      settings({ mutedCatchIds: ["a"] }),
      today,
    );
    expect(r.every((x) => x.catchId === "b")).toBe(true);
    expect(r.length).toBeGreaterThan(0);
  });
  it("Feb 29 anniversaries fall back to Feb 28 in non-leap years and Feb 29 in leap years", () => {
    expect(toIso(anniversaryIn("2024-02-29", 2026))).toBe("2026-02-28");
    expect(toIso(anniversaryIn("2024-02-29", 2028))).toBe("2028-02-29");
  });
  it("handles year changes: a December catch reminds into the next year", () => {
    const lateDec = new Date(2026, 11, 28); // 28 Dec 2026
    const r = upcomingReminders([{ id: "a", date: "2025-01-05" }], settings(), lateDec, 60);
    expect(r.map((x) => toIso(x.remindOn))).toEqual(["2026-12-29", "2027-01-02", "2027-01-05"]);
    expect(r[0]?.yearsAgo).toBe(2);
  });
});

describe("reminder settings migration and persistence", () => {
  it("converts the oldest bare-array format to custom reminders at the default time", () => {
    const legacy = [
      { id: "week", label: "A week before", daysBefore: 7, enabled: true },
      { id: "three", label: "A few days before", daysBefore: 5, enabled: false },
      { id: "day", label: "On the anniversary", daysBefore: 0, enabled: true },
    ];
    expect(migrateSettings(legacy)).toEqual({
      master: true,
      prefs: [
        { id: "week", daysBefore: 7, time: DEFAULT_TIME, enabled: true },
        { id: "three", daysBefore: 5, time: DEFAULT_TIME, enabled: false },
        { id: "day", daysBefore: 0, time: DEFAULT_TIME, enabled: true },
      ],
      mutedCatchIds: [],
    });
  });
  it("converts the fixed 7/3/0 object format, keeping master, days, enabled and mutes", () => {
    const legacy = {
      master: false,
      prefs: [
        { id: "week", label: "A week before", daysBefore: 10, enabled: true },
        { id: "three", label: "A few days before", daysBefore: 3, enabled: false },
        { id: "day", label: "On the anniversary", daysBefore: 0, enabled: true },
      ],
      mutedCatchIds: ["a"],
    };
    const migrated = migrateSettings(legacy);
    expect(migrated?.master).toBe(false);
    expect(migrated?.mutedCatchIds).toEqual(["a"]);
    expect(migrated?.prefs.map((p) => [p.daysBefore, p.time, p.enabled])).toEqual([[10, "09:00", true], [3, "09:00", false], [0, "09:00", true]]);
  });
  it("accepts the current customizable format unchanged", () => {
    const current = { master: true, prefs: [{ id: "x", daysBefore: 14, time: "07:15", enabled: true }], mutedCatchIds: [] };
    expect(migrateSettings(current)).toEqual(current);
  });
  it("rejects invalid times, day counts, duplicate ids and non-objects", () => {
    expect(migrateSettings({ prefs: [{ id: "x", daysBefore: 1, time: "25:00", enabled: true }] })).toBeNull();
    expect(migrateSettings({ prefs: [{ id: "x", daysBefore: 31, time: "09:00", enabled: true }] })).toBeNull();
    expect(migrateSettings({ prefs: [{ id: "x", daysBefore: -1, time: "09:00", enabled: true }] })).toBeNull();
    expect(migrateSettings({ prefs: [
      { id: "x", daysBefore: 1, time: "09:00", enabled: true },
      { id: "x", daysBefore: 2, time: "09:00", enabled: true },
    ] })).toBeNull();
    expect(migrateSettings(null)).toBeNull();
    expect(migrateSettings("nope")).toBeNull();
  });
  it("loadSettings migrates a stored legacy format and saveSettings round-trips", () => {
    localStorage.clear();
    localStorage.setItem("catchback-reminder-prefs", JSON.stringify([
      { id: "week", label: "A week before", daysBefore: 7, enabled: true },
      { id: "three", label: "A few days before", daysBefore: 3, enabled: true },
      { id: "day", label: "On the anniversary", daysBefore: 0, enabled: true },
    ]));
    expect(loadSettings().prefs.every((p) => p.time === DEFAULT_TIME)).toBe(true);
    const custom = settings({ prefs: [{ id: "x", daysBefore: 12, time: "05:45", enabled: true }] });
    saveSettings(custom);
    expect(loadSettings()).toEqual(custom);
    localStorage.clear();
  });
});
