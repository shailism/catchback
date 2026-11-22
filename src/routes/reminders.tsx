import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { BellRing, FlaskConical, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCatches, formatDate } from "@/lib/use-catches";
import { CatchRow } from "@/components/CatchThumb";
import { ReminderControls } from "@/components/ReminderControls";
import { DEFAULT_SETTINGS, loadSettings, saveSettings, toIso, upcomingReminders, type ReminderSettings } from "@/lib/reminders";

export const Route = createFileRoute("/reminders")({
  head: () => ({
    meta: [
      { title: "Anniversary reminders — CatchBack" },
      { name: "description", content: "Choose when CatchBack reminds you of each catch's anniversary." },
      { property: "og:title", content: "Anniversary reminders — CatchBack" },
      { property: "og:description", content: "Yearly catch anniversary reminders." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Reminders,
});

function Reminders() {
  const { catches, error } = useCatches();
  const [settings, setSettings] = useState<ReminderSettings>(DEFAULT_SETTINGS);
  const [today, setToday] = useState<Date | null>(null);
  const [demo, setDemo] = useState<string | null>(null);
  const [notificationsSupported, setNotificationsSupported] = useState<boolean | null>(null);
  useEffect(() => {
    setSettings(loadSettings());
    setToday(new Date());
    setNotificationsSupported("Notification" in window);
  }, []);

  const update = (next: ReminderSettings) => {
    setSettings(next);
    saveSettings(next);
  };

  const upcoming = useMemo(() => (catches && today ? upcomingReminders(catches, settings, today, 60) : []), [catches, settings, today]);
  const demoCatch = demo ? catches?.find((c) => c.id === demo) : undefined;

  return (
    <div className="page space-y-5">
      <h1 className="page-title">Anniversary reminders</h1>
      <p className="text-muted-foreground">A yearly nudge on the date of a past catch, linked to its species and spot.</p>
      {error && <p role="alert" className="text-destructive">{error}</p>}

      <section className="card-panel space-y-4">
        <h2 className="font-semibold">Remind me each year</h2>
        <ReminderControls settings={settings} onChange={update} />
        <p className="text-sm text-muted-foreground">You can also switch off the reminder for a single catch on that catch's page.</p>
        <p className="rounded-xl bg-secondary p-3 text-sm text-secondary-foreground">
          Reminders show inside CatchBack when you open it, using this device's local time. Phone notifications while the app is closed are <strong>not available yet</strong> in this prototype.
          {notificationsSupported === false && " This browser does not support phone notifications at all."}
          {notificationsSupported === true && " This browser supports phone notifications, but CatchBack cannot deliver them while closed yet."}
        </p>
        <p className="text-sm text-muted-foreground">Anniversary reminders are about the date only — they don't mean weather or fishing conditions will match.</p>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">Coming up (next 60 days)</h2>
        {!settings.master && <p className="text-sm text-muted-foreground">Anniversary reminders are switched off.</p>}
        {settings.master && upcoming.length === 0 && <p className="text-sm text-muted-foreground">Nothing coming up. Reminders start from a catch's first anniversary.</p>}
        {upcoming.map((r) => {
          const c = catches?.find((x) => x.id === r.catchId);
          return c ? (
            <CatchRow key={r.catchId + r.prefId + r.anniversary.getFullYear()} c={c}
              extra={`${r.daysUntil === 0 ? "Today" : formatDate(toIso(r.remindOn))} at ${r.remindOn.toTimeString().slice(0, 5)} · ${r.label.toLowerCase()} (${r.yearsAgo}y)`} />
          ) : null;
        })}
      </section>

      <section className="card-panel space-y-3 border-2 border-dashed border-primary/40">
        <h2 className="flex items-center gap-2 font-semibold"><FlaskConical className="size-5 text-primary" /> Demo: try a reminder now</h2>
        <p className="text-sm text-muted-foreground">This is a test. It shows what an in-app reminder looks like for one of your catches, without waiting a year.</p>
        {catches && catches.length > 0 ? (
          <Button className="h-12 w-full" onClick={() => setDemo(catches[Math.floor(Math.random() * catches.length)]?.id ?? null)}>
            <BellRing /> Show demo reminder
          </Button>
        ) : (
          <p className="text-sm">Add a catch first to try the demo.</p>
        )}
      </section>

      {demoCatch && (
        <div className="fixed inset-x-3 top-3 z-50 mx-auto max-w-md rounded-2xl bg-primary p-4 text-primary-foreground shadow-soft animate-in slide-in-from-top">
          <div className="flex items-start gap-3">
            <BellRing className="size-7 shrink-0" />
            <div className="flex-1 text-sm">
              <p className="text-xs font-bold uppercase tracking-wide opacity-80">Demo reminder</p>
              <p className="font-semibold">A week to go! On {formatDate(demoCatch.date).replace(/ \d{4}$/, "")} you caught {demoCatch.species || "a fish"}{demoCatch.place ? ` at ${demoCatch.place}` : ""}.</p>
              <p className="opacity-90">Time to plan a trip back?</p>
            </div>
            <button aria-label="Close demo" onClick={() => setDemo(null)}><X /></button>
          </div>
        </div>
      )}
    </div>
  );
}
