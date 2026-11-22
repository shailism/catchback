import { Minus, Plus, Trash2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { DEFAULT_TIME, MAX_REMINDERS, reminderLabel, type ReminderSettings } from "@/lib/reminders";

/**
 * Shared anniversary-reminder controls: one master switch plus a customizable
 * list of reminders (days before + local time), each editable and removable.
 * Used in Settings and on the Reminders page.
 */
export function ReminderControls({ settings, onChange }: { settings: ReminderSettings; onChange: (s: ReminderSettings) => void }) {
  const update = (id: string, p: Partial<ReminderSettings["prefs"][number]>) =>
    onChange({ ...settings, prefs: settings.prefs.map((x) => (x.id === id ? { ...x, ...p } : x)) });
  const remove = (id: string) => onChange({ ...settings, prefs: settings.prefs.filter((x) => x.id !== id) });
  const add = () =>
    onChange({
      ...settings,
      prefs: [...settings.prefs, { id: crypto.randomUUID(), daysBefore: 7, time: DEFAULT_TIME, enabled: true }],
    });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">Anniversary reminders</p>
          <p className="text-sm text-muted-foreground">Master switch for all catch anniversaries.</p>
        </div>
        <Switch className="scale-125" checked={settings.master} onCheckedChange={(v) => onChange({ ...settings, master: v })} aria-label="Switch all anniversary reminders on or off" />
      </div>

      {settings.prefs.length === 0 && (
        <p className="text-sm text-muted-foreground">No reminders set. Add one below to be reminded of catch anniversaries.</p>
      )}
      {settings.prefs.map((p) => (
        <div key={p.id} className="space-y-2 rounded-xl border border-border p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="font-medium">{reminderLabel(p.daysBefore)}</p>
            <Switch className="scale-125" disabled={!settings.master} checked={p.enabled} onCheckedChange={(v) => update(p.id, { enabled: v })} aria-label={`Toggle reminder ${reminderLabel(p.daysBefore).toLowerCase()} at ${p.time}`} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button className="icon-btn" aria-label="Fewer days" disabled={!settings.master} onClick={() => update(p.id, { daysBefore: Math.max(0, p.daysBefore - 1) })}><Minus className="size-4" /></button>
            <button className="icon-btn" aria-label="More days" disabled={!settings.master} onClick={() => update(p.id, { daysBefore: Math.min(30, p.daysBefore + 1) })}><Plus className="size-4" /></button>
            <label className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">at</span>
              <input
                type="time"
                className="h-11 rounded-lg border border-input bg-background px-3 text-base disabled:opacity-50"
                value={p.time}
                disabled={!settings.master}
                aria-label={`Time for reminder ${reminderLabel(p.daysBefore).toLowerCase()}`}
                onChange={(e) => e.target.value && update(p.id, { time: e.target.value })}
              />
            </label>
            <button className="icon-btn ml-auto text-destructive" aria-label={`Remove reminder ${reminderLabel(p.daysBefore).toLowerCase()} at ${p.time}`} disabled={!settings.master} onClick={() => remove(p.id)}><Trash2 className="size-4" /></button>
          </div>
        </div>
      ))}

      <Button variant="outline" className="h-12 w-full" disabled={!settings.master || settings.prefs.length >= MAX_REMINDERS} onClick={add}>
        <Plus /> Add a reminder
      </Button>
      {!settings.master && <p className="text-sm text-muted-foreground">All anniversary reminders are off. Turn the master switch on to edit the reminders above.</p>}
    </div>
  );
}
