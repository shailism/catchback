export type ReminderPref = {
  id: string;
  /** Days before the anniversary; 0 means on the anniversary itself. */
  daysBefore: number;
  /** Local time of day, "HH:MM" 24-hour, in the device's timezone. */
  time: string;
  enabled: boolean;
};

export const MAX_REMINDERS = 10;
export const DEFAULT_TIME = "09:00";

export const DEFAULT_PREFS: ReminderPref[] = [
  { id: "week", daysBefore: 7, time: DEFAULT_TIME, enabled: true },
  { id: "three", daysBefore: 3, time: DEFAULT_TIME, enabled: true },
  { id: "day", daysBefore: 0, time: DEFAULT_TIME, enabled: true },
];

export type ReminderSettings = {
  /** Master switch: when false, no anniversary reminders are shown at all. */
  master: boolean;
  prefs: ReminderPref[];
  /** Catches the user has individually muted. */
  mutedCatchIds: string[];
};

export const DEFAULT_SETTINGS: ReminderSettings = { master: true, prefs: DEFAULT_PREFS, mutedCatchIds: [] };

const KEY = "catchback-reminder-prefs";

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function validPref(p: unknown): p is ReminderPref {
  if (!p || typeof p !== "object") return false;
  const x = p as Record<string, unknown>;
  const days = x["daysBefore"];
  return typeof x["id"] === "string" && (x["id"] as string).trim().length > 0 &&
    Number.isInteger(days) && (days as number) >= 0 && (days as number) <= 30 &&
    typeof x["time"] === "string" && TIME_RE.test(x["time"] as string) &&
    typeof x["enabled"] === "boolean";
}

/** Older versions stored {id, label, daysBefore, enabled} without a time. */
function legacyPref(p: unknown): p is { id: string; daysBefore: number; enabled: boolean } {
  if (!p || typeof p !== "object") return false;
  const x = p as Record<string, unknown>;
  const days = x["daysBefore"];
  return typeof x["id"] === "string" && (x["id"] as string).trim().length > 0 &&
    typeof x["label"] === "string" && !("time" in x) &&
    Number.isInteger(days) && (days as number) >= 0 && (days as number) <= 30 &&
    typeof x["enabled"] === "boolean";
}

function validPrefs(prefs: ReminderPref[]): boolean {
  return prefs.length <= MAX_REMINDERS && new Set(prefs.map((p) => p.id)).size === prefs.length;
}

/**
 * Convert any stored or backed-up reminder value into current settings.
 * Accepts the oldest bare-array format, the fixed 7/3/0 object format
 * (migrated to the default time) and the current customizable format.
 * Returns null when the value is unusable.
 */
export function migrateSettings(raw: unknown): ReminderSettings | null {
  const fromLegacy = (prefs: unknown[]): ReminderPref[] | null =>
    prefs.every(legacyPref) ? prefs.map((p) => ({ id: p.id, daysBefore: p.daysBefore, time: DEFAULT_TIME, enabled: p.enabled })) : null;

  // Oldest format: just the three preferences as an array.
  if (Array.isArray(raw)) {
    const prefs = fromLegacy(raw);
    return prefs && validPrefs(prefs) ? { master: true, prefs, mutedCatchIds: [] } : null;
  }
  if (!raw || typeof raw !== "object" || !("prefs" in raw)) return null;
  const s = raw as { master?: unknown; prefs?: unknown; mutedCatchIds?: unknown };
  if (!Array.isArray(s.prefs)) return null;
  const prefs = s.prefs.every(validPref) ? (s.prefs as ReminderPref[]) : fromLegacy(s.prefs);
  if (!prefs || !validPrefs(prefs)) return null;
  return {
    master: s.master !== false,
    prefs,
    mutedCatchIds: Array.isArray(s.mutedCatchIds) ? s.mutedCatchIds.filter((id): id is string => typeof id === "string") : [],
  };
}

export function loadSettings(): ReminderSettings {
  try {
    const migrated = migrateSettings(JSON.parse(localStorage.getItem(KEY) || "null"));
    if (migrated) return migrated;
  } catch {}
  return DEFAULT_SETTINGS;
}

export function saveSettings(s: ReminderSettings) {
  localStorage.setItem(KEY, JSON.stringify(s));
}

export function parseDate(s: string): Date {
  const [y = 0, m = 1, d = 1] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
export function toIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
/** Anniversary in a given year; Feb 29 falls back to Feb 28 in non-leap years. */
export function anniversaryIn(catchDate: string, year: number): Date {
  const o = parseDate(catchDate);
  const d = new Date(year, o.getMonth(), o.getDate());
  if (d.getMonth() !== o.getMonth()) return new Date(year, o.getMonth() + 1, 0);
  return d;
}

export function reminderLabel(daysBefore: number): string {
  return daysBefore === 0 ? "On the anniversary" : `${daysBefore} day${daysBefore > 1 ? "s" : ""} before`;
}

export type UpcomingReminder = {
  catchId: string;
  prefId: string;
  label: string;
  remindOn: Date;
  anniversary: Date;
  yearsAgo: number;
  daysUntil: number;
};

export function upcomingReminders(
  catches: { id: string; date: string }[],
  settings: ReminderSettings,
  today: Date,
  windowDays = 60,
): UpcomingReminder[] {
  if (!settings.master) return [];
  const muted = new Set(settings.mutedCatchIds);
  const t = startOfDay(today);
  const out: UpcomingReminder[] = [];
  for (const c of catches) {
    if (muted.has(c.id)) continue;
    const catchYear = parseDate(c.date).getFullYear();
    for (const year of [t.getFullYear(), t.getFullYear() + 1]) {
      if (year <= catchYear) continue;
      const ann = anniversaryIn(c.date, year);
      for (const p of settings.prefs) {
        if (!p.enabled) continue;
        const [h = 9, m = 0] = p.time.split(":").map(Number);
        const remindOn = new Date(ann.getFullYear(), ann.getMonth(), ann.getDate() - p.daysBefore, h, m);
        const daysUntil = Math.round((startOfDay(remindOn).getTime() - t.getTime()) / 86400000);
        if (daysUntil < 0 || daysUntil > windowDays) continue;
        out.push({ catchId: c.id, prefId: p.id, label: reminderLabel(p.daysBefore), remindOn, anniversary: ann, yearsAgo: year - catchYear, daysUntil });
      }
    }
  }
  return out.sort((a, b) => a.remindOn.getTime() - b.remindOn.getTime());
}
