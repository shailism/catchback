/** Pure helpers for live conditions (Open-Meteo). No fishing predictions — only calm-weather windows. */

export type SavedLocation = { lat: number; lng: number; savedAt: number };
export type HourCondition = { time: string; temp: number; wind: number; direction: number; code: number; wave: number | null };
export type LiveConditions = {
  current: HourCondition;
  hours: HourCondition[];
  sunrise: string | null;
  window: { day: string; start: string; end: string; avgWind: number; maxWave: number | null } | null;
};

export const LOCATION_KEY = "catchback.conditionsLocation";

export function parseSavedLocation(raw: string | null): SavedLocation | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<SavedLocation>;
    if (typeof v.lat !== "number" || typeof v.lng !== "number" || !Number.isFinite(v.lat) || !Number.isFinite(v.lng)) return null;
    if (Math.abs(v.lat) > 90 || Math.abs(v.lng) > 180) return null;
    return { lat: v.lat, lng: v.lng, savedAt: typeof v.savedAt === "number" ? v.savedAt : 0 };
  } catch { return null; }
}

/** Coordinates are rounded to ~1 km before leaving the device. */
export const coarse = (n: number) => Math.round(n * 100) / 100;

export function compass(deg: number): string {
  return ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round(((deg % 360) + 360) % 360 / 45) % 8] ?? "N";
}

export function skyLabel(code: number): string {
  if (code === 0) return "Clear";
  if (code <= 3) return "Partly cloudy";
  if (code <= 48) return "Fog";
  if (code <= 67 || (code >= 80 && code <= 82)) return "Rain";
  if (code <= 77 || code === 85 || code === 86) return "Snow";
  return "Thunderstorm";
}

/**
 * Calmest 3-hour daylight stretch from now on, by wind and (if known) wave height.
 * Describes weather only — never fish activity or catch chances.
 */
export function calmestWindow(hours: HourCondition[], from: string, daylight: { start: string; end: string }[]): LiveConditions["window"] {
  const inDay = (t: string) => daylight.some((d) => t >= d.start && t < d.end);
  const usable = hours.filter((h) => h.time >= from && inDay(h.time));
  let best: { score: number; i: number } | null = null;
  for (let i = 0; i + 2 < usable.length; i++) {
    const block = usable.slice(i, i + 3);
    // Must be consecutive hours.
    const t0 = Date.parse(block[0]!.time), t2 = Date.parse(block[2]!.time);
    if (t2 - t0 !== 2 * 3600_000) continue;
    const score = block.reduce((s, h) => s + h.wind + (h.wave ?? 0) * 20, 0);
    if (!best || score < best.score) best = { score, i };
  }
  if (!best) return null;
  const block = usable.slice(best.i, best.i + 3);
  const waves = block.map((h) => h.wave).filter((w): w is number => w != null);
  const end = new Date(Date.parse(block[2]!.time) + 3600_000);
  return {
    day: block[0]!.time.slice(0, 10),
    start: block[0]!.time.slice(11, 16),
    end: `${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}`,
    avgWind: Math.round(block.reduce((s, h) => s + h.wind, 0) / 3),
    maxWave: waves.length === 3 ? Math.max(...waves) : null,
  };
}

type ForecastJson = {
  current: { time: string; temperature_2m: number; wind_speed_10m: number; wind_direction_10m: number; weather_code: number };
  hourly: { time: string[]; temperature_2m: number[]; wind_speed_10m: number[]; wind_direction_10m: number[]; weather_code: number[] };
  daily: { sunrise: string[]; sunset: string[] };
};
type MarineJson = { hourly?: { time: string[]; wave_height: (number | null)[] } };

export function buildConditions(f: ForecastJson, m: MarineJson | null): LiveConditions {
  const waveAt = new Map<string, number | null>();
  m?.hourly?.time.forEach((t, i) => waveAt.set(t, m.hourly!.wave_height[i] ?? null));
  const hours: HourCondition[] = f.hourly.time.map((time, i) => ({
    time,
    temp: Math.round(f.hourly.temperature_2m[i] ?? 0),
    wind: Math.round(f.hourly.wind_speed_10m[i] ?? 0),
    direction: f.hourly.wind_direction_10m[i] ?? 0,
    code: f.hourly.weather_code[i] ?? 0,
    wave: waveAt.get(time) ?? null,
  }));
  const nowHour = f.current.time.slice(0, 13) + ":00";
  const current: HourCondition = {
    time: f.current.time,
    temp: Math.round(f.current.temperature_2m),
    wind: Math.round(f.current.wind_speed_10m),
    direction: f.current.wind_direction_10m,
    code: f.current.weather_code,
    wave: waveAt.get(nowHour) ?? null,
  };
  const daylight = f.daily.sunrise.map((s, i) => ({ start: s, end: f.daily.sunset[i] ?? s }));
  const today = f.current.time.slice(0, 10);
  return {
    current,
    hours: hours.filter((h) => h.time >= nowHour).slice(0, 12),
    sunrise: f.daily.sunrise.find((s) => s.startsWith(today))?.slice(11, 16) ?? null,
    window: calmestWindow(hours, f.current.time, daylight),
  };
}

/** Swappable weather source: any provider returning LiveConditions for saved device coordinates. */
export type WeatherProvider = { name: string; fetchConditions(loc: SavedLocation, signal?: AbortSignal): Promise<LiveConditions> };

async function openMeteoFetch(loc: SavedLocation, signal?: AbortSignal): Promise<LiveConditions> {
  const q = `latitude=${coarse(loc.lat)}&longitude=${coarse(loc.lng)}&timezone=auto&forecast_days=2`;
  const fr = await fetch(`https://api.open-meteo.com/v1/forecast?${q}&current=temperature_2m,wind_speed_10m,wind_direction_10m,weather_code&hourly=temperature_2m,wind_speed_10m,wind_direction_10m,weather_code&daily=sunrise,sunset`, { signal: signal ?? null });
  if (!fr.ok) throw new Error(`Weather service error ${fr.status}`);
  const f = (await fr.json()) as ForecastJson;
  let m: MarineJson | null = null;
  try {
    const mr = await fetch(`https://marine-api.open-meteo.com/v1/marine?${q}&hourly=wave_height`, { signal: signal ?? null });
    if (mr.ok) m = (await mr.json()) as MarineJson;
  } catch { m = null; }
  return buildConditions(f, m);
}

export const openMeteo: WeatherProvider = { name: "Open-Meteo", fetchConditions: openMeteoFetch };
/** Change this one line to switch weather providers. */
export const weatherProvider: WeatherProvider | null = null; // e.g. openMeteo — disabled for now
