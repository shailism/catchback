import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { isNativeApp, shareFilesNative } from "@/lib/native-files";
import { CheckCircle2, Clock3, Download, Lock, Upload, Bell, ChevronRight, Sparkles, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { exportBackup, importBackup, protectStorage, storageError } from "@/lib/db";
import { OfflineStatus } from "@/components/OfflineStatus";
import { ReminderControls } from "@/components/ReminderControls";
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type ReminderSettings } from "@/lib/reminders";

export const Route = createFileRoute("/more")({
  head: () => ({
    meta: [
      { title: "Backup & privacy — CatchBack" },
      { name: "description", content: "Back up your catches, learn how storage works and see what's planned." },
      { property: "og:title", content: "Backup & privacy — CatchBack" },
      { property: "og:description", content: "Back up your catches and see what's planned." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: More,
});

const WORKING = [
  "Add catches from camera or gallery",
  "Read photo date, time and GPS when present",
  "Confirm or edit every detail yourself",
  "Calendar and photo views, editable details",
  "Basic catch statistics in Insights",
  "Manual trip logging, including no catches",
  "Catch anniversary reminders inside the app, with custom days and times, plus master and per-catch switches",
  "Backup export and import",
];
const PLANNED = [
  "Weather history for each catch",
  "Alerts when conditions look similar",
  "Species suggestions from photos (you confirm)",
  "Public posting",
  "Private group sharing",
  "Phone notifications while the app is closed",
];

function More() {
  const file = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [protectedStorage, setProtectedStorage] = useState<boolean | null>(null);
  const [reminderSettings, setReminderSettings] = useState<ReminderSettings>(DEFAULT_SETTINGS);
  useEffect(() => {
    navigator.storage?.persisted().then(setProtectedStorage).catch(() => setProtectedStorage(false));
    if (!navigator.storage) setProtectedStorage(false);
    setReminderSettings(loadSettings());
  }, []);
  const updateReminders = (next: ReminderSettings) => { setReminderSettings(next); saveSettings(next); };
  const doExport = async () => {
    try {
    const blob = await exportBackup();
    const name = `catchback-backup-${new Date().toISOString().slice(0, 10)}.json`;
    if (isNativeApp()) {
      // Same backup file; the phone's menu lets the user save it to Files, Drive, email, etc.
      const r = await shareFilesNative([{ name, blob }], undefined, "Save CatchBack backup");
      if (r === "cancelled") toast("Backup export cancelled. Nothing was saved.");
      else toast.success("Backup handed to the option you picked. Check it saved there before relying on it.");
      return;
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
    } catch (error) { toast.error(storageError(error, "export")); }
  };
  return (
    <div className="page space-y-5">
      <h1 className="page-title">Settings & privacy</h1>
      <OfflineStatus />
      <section className="card-panel space-y-4">
        <h2 className="flex items-center gap-2 font-semibold"><Bell className="size-5 text-primary" /> Anniversary reminders</h2>
        <ReminderControls settings={reminderSettings} onChange={updateReminders} />
        <p className="text-sm text-muted-foreground">Reminders appear inside the app only, in this device's local time. They are about the date — not a promise of matching weather or fishing conditions. Single catches can be muted on their own pages.</p>
        <Button asChild variant="secondary" className="h-12 w-full justify-between"><Link to="/reminders"><span>Upcoming reminders and demo</span><ChevronRight /></Link></Button>
        <p className="text-sm text-muted-foreground">Forecast alerts, units and phone notification settings are planned.</p>
      </section>
      <Button asChild variant="secondary" className="h-14 w-full justify-between"><Link to="/plans"><span className="flex items-center gap-2"><Sparkles /> Free & Plus</span><ChevronRight /></Link></Button>
      <Button asChild variant="secondary" className="h-14 w-full justify-between"><Link to="/community"><span className="flex items-center gap-2"><Users /> Community — planned</span><ChevronRight /></Link></Button>

      <section className="card-panel space-y-3">
        <h2 className="flex items-center gap-2 font-semibold"><Lock className="size-5 text-primary" /> Private, on this device</h2>
        <p className="text-sm">Your catches, photos, trips and spots are stored only in this browser on this device. Nothing is uploaded or shared.</p>
        <p className="rounded-xl bg-warning p-3 text-sm text-warning-foreground">
          Clearing browser data, automatic site-data clearing, using private mode, or uninstalling the browser can delete your catches. Low device storage can also put unprotected browser data at risk. Export a backup regularly and reopen the same website address.
        </p>
        <p className="text-sm">{protectedStorage === null ? "Checking storage protection…" : protectedStorage ? "Browser storage protection is granted. Clearing site data can still delete catches." : "Browser storage protection is not granted. Manual backups are essential."}</p>
        {protectedStorage === false && <Button variant="outline" className="h-12 w-full" onClick={async () => setProtectedStorage(await protectStorage())}>Request storage protection</Button>}
      </section>

      <section className="card-panel space-y-3">
        <h2 className="font-semibold">Backup</h2>
        <Button className="h-14 w-full text-base" onClick={doExport}><Download /> Export backup file</Button>
        <input ref={file} type="file" accept="application/json,.json" hidden onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f || importing) return;
          setImporting(true);
          try {
            const count = await importBackup(f, (matches) => window.confirm(
              `This backup will replace ${matches.catches} saved catches (and their photos) and ${matches.trips} saved trips. Newer edits will be lost. Other catches and trips will stay unchanged. Replace them?`,
            ));
            if (count === null) toast("Import cancelled. No catches or trips were changed.");
            else toast.success(`Imported ${count.catches} catches and ${count.trips} trips`);
          }
          catch (err) { toast.error((err as Error).message || "Couldn't read that file"); }
          finally { setImporting(false); }
        }} />
        <Button variant="outline" className="h-14 w-full text-base" disabled={importing} onClick={() => file.current?.click()}><Upload /> {importing ? "Checking and restoring…" : "Import backup file"}</Button>
        <p className="text-xs text-muted-foreground">Version-3 backups contain catches, photos, locations, trips and your reminder settings — keep them private. Older backups still work and leave your reminder settings unchanged. Replacements require your confirmation. Older CatchBack versions cannot restore these new backups.</p>
      </section>

      <section className="card-panel space-y-2">
        <h2 className="font-semibold">Working now</h2>
        {WORKING.map((w) => <p key={w} className="flex gap-2 text-sm"><CheckCircle2 className="size-5 shrink-0 text-primary" /> {w}</p>)}
      </section>
      <section className="card-panel space-y-2 bg-muted">
        <h2 className="font-semibold">Planned — not built yet</h2>
        {PLANNED.map((w) => <p key={w} className="flex gap-2 text-sm text-muted-foreground"><Clock3 className="size-5 shrink-0" /> {w}</p>)}
      </section>
    </div>
  );
}
