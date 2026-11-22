import { useEffect, useState } from "react";
import { CloudSun, MapPin, Wind, Waves, Sunrise, ArrowUpRight, Info, Navigation, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LOCATION_KEY, compass, weatherProvider, parseSavedLocation, skyLabel, type LiveConditions, type SavedLocation } from "@/lib/conditions";

/** Live conditions for a location the user explicitly shared from this device. Never uses typed text or sample places. */
export function DemoConditions() {
  const [loc, setLoc] = useState<SavedLocation | null>(null);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState("");
  const [data, setData] = useState<LiveConditions | null>(null);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(0);
  const [reload, setReload] = useState(0);

  useEffect(() => { setLoc(parseSavedLocation(localStorage.getItem(LOCATION_KEY))); }, []);

  useEffect(() => {
    if (!loc || !weatherProvider) return;
    const provider = weatherProvider;
    const ctrl = new AbortController();
    setLoading(true); setLoadError("");
    provider.fetchConditions(loc, ctrl.signal)
      .then((c) => { setData(c); setSelected(0); })
      .catch((e) => { if (!ctrl.signal.aborted) setLoadError(navigator.onLine === false ? "You're offline. Conditions need a signal." : `Couldn't load conditions. ${e instanceof Error ? e.message : ""}`); })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false); });
    return () => ctrl.abort();
  }, [loc, reload]);

  const locate = () => {
    setLocError("");
    if (!navigator.geolocation) return setLocError("Location isn't available on this device or browser.");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const next = { lat: +p.coords.latitude.toFixed(5), lng: +p.coords.longitude.toFixed(5), savedAt: Date.now() };
        localStorage.setItem(LOCATION_KEY, JSON.stringify(next));
        setLoc(next); setLocating(false);
      },
      (err) => {
        setLocating(false);
        setLocError(err.code === err.PERMISSION_DENIED
          ? "Location access was denied. Allow location for this site in your browser settings, then try again."
          : err.code === err.TIMEOUT ? "Finding your location took too long. Try again outdoors." : "Couldn't get your location. Try again.");
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 },
    );
  };

  const hour = data ? (data.hours[selected] ?? data.current) : null;

  return (
    <>
      <section className="conditions-section">
        <div className="flex items-center justify-between gap-2">
          <p className="flex min-w-0 items-center gap-2 text-sm font-semibold">
            <MapPin className="size-4 shrink-0 text-primary" />
            <span className="truncate">{loc ? `Your location · ${loc.lat.toFixed(2)}, ${loc.lng.toFixed(2)}` : "No location shared yet"}</span>
          </p>
          {data && <span className="demo-badge">LIVE</span>}
        </div>
        <Button variant="outline" className="mt-3 h-11 w-full" onClick={locate} disabled={locating}>
          <Navigation /> {locating ? "Finding you…" : loc ? "Update to my current location" : "Use my current location"}
        </Button>
        {locError && <p role="alert" className="mt-2 rounded-lg bg-warning p-3 text-sm text-warning-foreground">{locError}</p>}
        <p className="mt-2 text-xs text-muted-foreground">{weatherProvider ? <>Saved on this device only. Rounded to about 1 km and sent to {weatherProvider.name} (weather service) to get conditions.</> : "Saved on this device only. Nothing is sent anywhere."}</p>
        {!weatherProvider && <p role="status" className="mt-4 rounded-lg bg-secondary p-3 text-sm font-medium text-secondary-foreground"><span className="eyebrow block">Current conditions</span>Weather service not connected yet</p>}

        {weatherProvider && !loc && <p className="mt-4 text-sm text-muted-foreground">Share your location to see real wind, waves and temperature for where you are.</p>}
        {loc && loading && !data && <p role="status" className="mt-4 text-sm text-muted-foreground">Loading conditions…</p>}
        {loadError && (
          <div role="alert" className="mt-4 rounded-lg bg-warning p-3 text-sm text-warning-foreground">
            {loadError}
            <Button variant="outline" size="sm" className="mt-2 w-full" onClick={() => setReload((n) => n + 1)}><RefreshCw /> Try again</Button>
          </div>
        )}

        {hour && data && (
          <>
            <div className="mt-6 flex items-center justify-between">
              <div><p className="eyebrow">{selected === 0 ? "Now" : `Forecast · ${hour.time.slice(11, 16)}`}</p><p className="mt-1 flex items-baseline gap-3"><span className="temperature">{hour.temp}°</span><span className="text-sm text-muted-foreground">{skyLabel(hour.code)}</span></p></div>
              <CloudSun className="size-14 text-accent" strokeWidth={1.3} />
            </div>
            <div className="condition-metrics">
              <div><Wind /><strong>{hour.wind} <small>km/h {compass(hour.direction)}</small></strong><span>Wind</span></div>
              <div><Waves /><strong>{hour.wave != null ? <>{hour.wave.toFixed(1)} <small>m</small></> : "—"}</strong><span>{hour.wave != null ? "Waves" : "No wave data"}</span></div>
              <div><Sunrise /><strong>{data.sunrise ?? "—"}</strong><span>Sunrise</span></div>
            </div>
            <div className="mt-6 flex items-center justify-between"><h2 className="section-title">Next hours</h2><span className="text-xs text-muted-foreground">Local time at location</span></div>
            <div className="hourly-timeline" aria-label="Hourly forecast">
              {data.hours.map((h, i) => <Button key={h.time} variant="ghost" className={`hour-button ${selected === i ? "hour-active" : ""}`} onClick={() => setSelected(i)} aria-pressed={selected === i} aria-label={`Forecast at ${h.time.slice(11, 16)}`}><span>{h.time.slice(11, 16)}</span><CloudSun /><strong>{h.temp}°</strong><span className="hour-wind">{h.wind} km/h</span></Button>)}
            </div>
            <p className="mt-3 flex gap-2 text-xs text-muted-foreground"><Info className="size-4 shrink-0" />Forecast from {weatherProvider?.name}. Check official marine warnings before going out.</p>
          </>
        )}
      </section>

      {!weatherProvider && (
        <section className="fishing-window">
          <p className="eyebrow">Fishing window</p>
          <p className="mt-3 text-lg font-semibold">Weather service not connected yet</p>
        </section>
      )}
      {data && (
        <section className="fishing-window">
          <p className="eyebrow">Calmest weather window</p>
          <h2 className="mt-3 text-2xl font-bold">Your next fishing window</h2>
          {data.window ? (
            <>
              <p className="mt-2 text-lg font-semibold text-accent">{data.window.day === data.current.time.slice(0, 10) ? "Today" : "Tomorrow"} {data.window.start} – {data.window.end} <ArrowUpRight className="inline size-5" /></p>
              <p className="mt-3 text-sm leading-relaxed text-on-ocean-muted">
                The calmest 3 daylight hours in the forecast: about {data.window.avgWind} km/h wind
                {data.window.maxWave != null ? `, waves up to ${data.window.maxWave.toFixed(1)} m` : ", no wave data for this spot"}.
              </p>
            </>
          ) : <p className="mt-2 text-sm text-on-ocean-muted">No daylight hours left in the current forecast.</p>}
          <p className="mt-4 border-t border-ocean-line pt-3 text-xs text-on-ocean-muted">Based only on forecast wind and waves, not fish activity or your catches. Never a guarantee.</p>
        </section>
      )}
    </>
  );
}
