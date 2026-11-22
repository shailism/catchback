import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { BellRing, ChevronLeft, ChevronRight, Fish, Plus } from "lucide-react";
import { useCatches } from "@/lib/use-catches";
import { useTrips } from "@/lib/use-trips";
import { Button } from "@/components/ui/button";
import { CatchRow, CatchTile } from "@/components/CatchThumb";
import { loadSettings, toIso, upcomingReminders, type ReminderSettings, DEFAULT_SETTINGS } from "@/lib/reminders";

export const Route = createFileRoute("/journal")({
  head: () => ({
    meta: [
      { title: "Catch journal — CatchBack" },
      { name: "description", content: "Log catches from photos and get yearly reminders of when and where the fish were biting." },
      { property: "og:title", content: "Catch journal — CatchBack" },
      { property: "og:description", content: "Your private catch calendar and photo journal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

const WEEK = ["M", "T", "W", "T", "F", "S", "S"];

function Home() {
  const { catches, error } = useCatches();
  const { trips } = useTrips();
  const [tab, setTab] = useState<"calendar" | "photos">("calendar");
  const [month, setMonth] = useState<Date | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [today, setToday] = useState<Date | null>(null);
  const [reminderSettings, setReminderSettings] = useState<ReminderSettings>(DEFAULT_SETTINGS);
  useEffect(() => {
    const t = new Date();
    setToday(t);
    setMonth(new Date(t.getFullYear(), t.getMonth(), 1));
    setReminderSettings(loadSettings());
  }, []);

  const byDay = useMemo(() => {
    const m = new Map<string, number>();
    catches?.forEach((c) => m.set(c.date, (m.get(c.date) ?? 0) + 1));
    return m;
  }, [catches]);
  const tripsByDay = useMemo(() => {
    const m = new Map<string, number>();
    trips?.forEach((t) => m.set(t.date, (m.get(t.date) ?? 0) + 1));
    return m;
  }, [trips]);

  const next = useMemo(
    () => (catches && today ? upcomingReminders(catches, reminderSettings, today, 30)[0] : undefined),
    [catches, today, reminderSettings],
  );
  const nextCatch = next && catches?.find((c) => c.id === next.catchId);

  if (error) return <div className="page"><p role="alert" className="text-destructive">{error}</p><Button className="mt-4" onClick={() => window.location.reload()}>Retry loading</Button></div>;
  if (!catches || !month)
    return <div className="page text-muted-foreground">Loading your catches…</div>;

  const first = (month.getDay() + 6) % 7;
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  const dayCatches = selected ? catches.filter((c) => c.date === selected) : [];
  const dayTrips = selected && trips ? trips.filter((t) => t.date === selected) : [];
  const shift = (n: number) => { setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1)); setSelected(null); };

  return (
    <div className="page">
      <h1 className="page-title">Catch journal</h1>
      <p className="mb-4 text-muted-foreground">Your days on the water, remembered.</p>
      <div className="mb-5 grid grid-cols-2 gap-3">
        <Button asChild className="h-12"><Link to="/trips/$id" params={{ id: "new" }}><Plus />Log a trip</Link></Button>
        <Button asChild variant="secondary" className="h-12"><Link to="/trips">Trips<ChevronRight /></Link></Button>
      </div>

      {next && nextCatch && (
        <Link to="/reminders" className="mb-4 flex items-center gap-3 rounded-2xl bg-primary p-4 text-primary-foreground shadow-soft">
          <BellRing className="size-7 shrink-0" />
          <div className="text-sm">
            <p className="font-semibold">{next.daysUntil === 0 ? "Today" : `In ${next.daysUntil} days`}: {next.label.toLowerCase()}</p>
            <p className="opacity-90">{nextCatch.species || "A catch"} from {next.yearsAgo} year{next.yearsAgo > 1 ? "s" : ""} ago{nextCatch.place ? ` at ${nextCatch.place}` : ""}</p>
          </div>
        </Link>
      )}

      {catches.length === 0 ? (
        <div className="card-panel text-center">
          <p className="mb-4 text-lg font-semibold">No catches yet</p>
          <Link to="/add" className="big-action"><Plus className="size-7" /> Add your first catch</Link>
        </div>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 rounded-full bg-secondary p-1">
            {(["calendar", "photos"] as const).map((t) => (
              <Button key={t} variant="ghost" aria-pressed={tab === t} onClick={() => setTab(t)} className={`h-11 seg ${tab === t ? "seg-active" : ""}`}>
                {t === "calendar" ? "Calendar" : `Photos (${catches.length})`}
              </Button>
            ))}
          </div>

          {tab === "calendar" ? (
            <div className="card-panel">
              <div className="mb-3 flex items-center justify-between">
                <Button variant="ghost" aria-label="Previous month" className="icon-btn" onClick={() => shift(-1)}><ChevronLeft /></Button>
                <p className="font-semibold">{month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</p>
                <Button variant="ghost" aria-label="Next month" className="icon-btn" onClick={() => shift(1)}><ChevronRight /></Button>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
                {WEEK.map((w, i) => <span key={i}>{w}</span>)}
              </div>
              <div className="mt-1 grid grid-cols-7 gap-1">
                {cells.map((d, i) => {
                  if (!d) return <span key={i} />;
                  const iso = toIso(new Date(month.getFullYear(), month.getMonth(), d));
                  const n = byDay.get(iso) ?? 0;
                  const tripCount = tripsByDay.get(iso) ?? 0;
                  const isToday = today && iso === toIso(today);
                  return (
                    <Button key={i} onClick={() => setSelected(iso)}
                      variant="ghost" className={`h-auto p-0 day ${n || tripCount ? "day-has" : ""} ${selected === iso ? "day-selected" : ""} ${isToday ? "day-today" : ""}`}>
                      {d}
                      {n > 0 && <span className={`day-dot ${tripCount > 0 ? "day-dot-left" : ""}`}>{n > 1 ? n : ""}</span>}
                      {tripCount > 0 && <span className={`day-dot day-trip-dot ${n > 0 ? "day-dot-right" : ""}`} title="Logged trip">{tripCount > 1 ? tripCount : ""}</span>}
                    </Button>
                  );
                })}
              </div>
              {selected && (
                <div className="mt-4 space-y-2">
                  {dayCatches.map((c) => <CatchRow key={c.id} c={c} />)}
                  {dayTrips.map((t) => (
                    <Link key={t.id} to="/trips/$id" params={{ id: t.id }} className="flex items-center gap-3 border-b border-border py-3">
                      <span className="flex size-16 items-center justify-center rounded-xl bg-secondary"><Fish className="size-6 text-primary" /></span>
                      <span className="min-w-0">
                        <span className="block font-semibold">{t.outcome === "caught" ? "Trip — caught fish" : "Trip — no catches"}</span>
                        <span className="block truncate text-sm text-muted-foreground">{[t.spot, t.durationMinutes ? `${t.durationMinutes} min` : ""].filter(Boolean).join(" · ") || "Logged trip"}</span>
                      </span>
                    </Link>
                  ))}
                  {!dayCatches.length && !dayTrips.length && <p className="text-sm text-muted-foreground">No catches or trips on this day.</p>}
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {catches.map((c) => <CatchTile key={c.id} c={c} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}
