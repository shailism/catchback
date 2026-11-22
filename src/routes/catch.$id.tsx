import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { CatchForm } from "@/components/CatchForm";
import { ShareCatch } from "@/components/ShareCatch";
import { deleteCatch, getCatch, saveCatch, storageError, type Catch } from "@/lib/db";
import { loadSettings, saveSettings, type ReminderSettings } from "@/lib/reminders";

export const Route = createFileRoute("/catch/$id")({
  head: () => ({
    meta: [
      { title: "Catch details — CatchBack" },
      { name: "description", content: "View and edit a saved catch." },
      { property: "og:title", content: "Catch details — CatchBack" },
      { property: "og:description", content: "View and edit a saved catch." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Detail,
});

function Detail() {
  const { id } = Route.useParams();
  const [c, setC] = useState<Catch | null | undefined>(undefined);
  const [loadError, setLoadError] = useState("");
  const [reminderSettings, setReminderSettings] = useState<ReminderSettings | null>(null);
  const navigate = useNavigate();
  useEffect(() => {
    let active = true;
    setC(undefined); setLoadError("");
    setReminderSettings(loadSettings());
    getCatch(id).then((x) => { if (active) setC(x ?? null); })
      .catch((error) => { if (active) setLoadError(storageError(error, "load")); });
    return () => { active = false; };
  }, [id]);

  const reminderOn = reminderSettings ? !reminderSettings.mutedCatchIds.includes(id) : true;
  const toggleReminder = (on: boolean) => {
    if (!reminderSettings) return;
    const mutedCatchIds = on
      ? reminderSettings.mutedCatchIds.filter((x) => x !== id)
      : [...new Set([...reminderSettings.mutedCatchIds, id])];
    const next = { ...reminderSettings, mutedCatchIds };
    setReminderSettings(next);
    saveSettings(next);
  };

  return (
    <div className="page">
      <Link to="/" className="mb-3 inline-flex items-center gap-1 font-medium text-primary"><ArrowLeft className="size-4" /> Back</Link>
      {loadError ? <p role="alert" className="text-destructive">{loadError}</p> : c === undefined && <p className="text-muted-foreground">Loading…</p>}
      {c === null && <p>This catch isn't on this device.</p>}
      {c && (
        <>
          <header className="relative">
          <h1 className="page-title min-h-12 pr-16">{c.species || "Your catch"}</h1>
          <ShareCatch c={c} />
          </header>
          <CatchForm
            key={c.id}
            initial={c}
            saveLabel="Save changes"
            onSave={async (d) => {
              const protectedStorage = await saveCatch({ ...c, ...d });
              if (protectedStorage) toast.success("Changes and photo saved");
              else toast.warning("Changes saved. Browser storage protection wasn't granted — export a backup before closing.", { duration: 12000 });
              return protectedStorage;
            }}
          />
          <div className="card-panel mt-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium">Anniversary reminder for this catch</p>
              <p className="text-sm text-muted-foreground">Shown inside the app each year, using your reminder settings.</p>
            </div>
            <Switch className="scale-125" checked={reminderOn} onCheckedChange={toggleReminder} aria-label="Anniversary reminder for this catch" />
          </div>
          <Button variant="ghost" className="mt-4 h-12 w-full text-destructive"
            onClick={async () => {
              if (!confirm("Delete this catch and its photo from this device?")) return;
              await deleteCatch(c.id);
              toast("Catch deleted");
              navigate({ to: "/" });
            }}>
            <Trash2 /> Delete catch
          </Button>
        </>
      )}
    </div>
  );
}
