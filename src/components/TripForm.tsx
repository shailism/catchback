import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { tripStorageError, type Trip } from "@/lib/db";
import { toIso } from "@/lib/reminders";

export type TripDraft = Omit<Trip, "id" | "createdAt" | "outcome"> & { outcome: Trip["outcome"] | "" };
export function TripForm({ initial, onSave, initialFeedback = "" }: { initial: TripDraft; onSave: (draft: TripDraft & { outcome: Trip["outcome"] }) => Promise<boolean>; initialFeedback?: string }) {
  const [draft, setDraft] = useState(initial);
  const [duration, setDuration] = useState(initial.durationMinutes === undefined ? "" : String(initial.durationMinutes));
  const [errors, setErrors] = useState<{ date?: string; outcome?: string; duration?: string }>({});
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(initialFeedback);
  const [saveError, setSaveError] = useState("");
  const dateRef = useRef<HTMLInputElement>(null);
  const outcomeRef = useRef<HTMLInputElement>(null);
  const durationRef = useRef<HTMLInputElement>(null);
  const update = (patch: Partial<TripDraft>) => { setDraft(d => ({ ...d, ...patch })); setFeedback(""); };
  return <form noValidate className="space-y-5" onSubmit={async e => {
    e.preventDefault(); if (saving) return;
    setFeedback(""); setSaveError("");
    const next: typeof errors = {};
    const date = new Date(`${draft.date}T00:00:00Z`);
    if (!draft.date || isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== draft.date) next.date = "Choose a valid trip date.";
    if (!draft.outcome) next.outcome = "Choose Caught fish or No catches.";
    const text = duration.trim();
    const value = text ? Number(text.replace(",", ".")) : undefined;
    if (value !== undefined && (!Number.isFinite(value) || value <= 0)) next.duration = "Duration must be a number greater than 0, or left empty.";
    setErrors(next);
    if (next.date || next.outcome || next.duration) {
      (next.date ? dateRef : next.outcome ? outcomeRef : durationRef).current?.focus(); return;
    }
    if (!draft.outcome) return;
    setSaving(true);
    try {
      const protectedStorage = await onSave({ ...draft, outcome: draft.outcome, durationMinutes: value });
      setFeedback(protectedStorage ? "Trip saved on this device." : "Trip saved. Storage protection wasn't granted — export a backup before closing.");
    } catch (error) { setSaveError(tripStorageError(error)); }
    finally { setSaving(false); }
  }}>
    <p className="text-sm text-muted-foreground">A trip does not create catch-photo records. Optional details can be skipped.</p>
    <div>
      <label htmlFor="trip-date" className="text-sm font-semibold">Trip date</label>
      <Input ref={dateRef} id="trip-date" type="date" className="mt-1 h-12 text-base" value={draft.date} aria-invalid={!!errors.date} aria-describedby={errors.date ? "trip-date-error" : undefined} onChange={e => update({ date: e.target.value })} />
      {errors.date && <p id="trip-date-error" role="alert" className="mt-1 text-sm text-destructive">{errors.date}</p>}
      {!draft.date && <Button type="button" variant="outline" className="mt-2 h-11 w-full" onClick={() => update({ date: toIso(new Date()) })}>It was today</Button>}
    </div>
    <fieldset aria-describedby={errors.outcome ? "trip-outcome-error" : undefined}>
      <legend className="mb-2 text-sm font-semibold">Outcome</legend>
      <div className="grid grid-cols-2 gap-3">
        {([{ value: "caught", label: "Caught fish" }, { value: "none", label: "No catches" }] as const).map((option, i) => <label key={option.value} className="flex min-h-12 cursor-pointer items-center gap-2 rounded-lg border border-border px-3 text-sm">
          <input ref={i === 0 ? outcomeRef : undefined} type="radio" name="trip-outcome" value={option.value} checked={draft.outcome === option.value} aria-invalid={!!errors.outcome} aria-describedby={errors.outcome ? "trip-outcome-error" : undefined} onChange={() => update({ outcome: option.value })} />{option.label}
        </label>)}
      </div>
      {errors.outcome && <p id="trip-outcome-error" role="alert" className="mt-1 text-sm text-destructive">{errors.outcome}</p>}
    </fieldset>
    <div>
      <label htmlFor="trip-spot" className="text-sm font-medium">Spot name <span className="text-muted-foreground">— optional</span></label>
      <Input id="trip-spot" className="mt-1 h-12" maxLength={200} value={draft.spot ?? ""} onChange={e => update({ spot: e.target.value || undefined })} />
    </div>
    <div>
      <label htmlFor="trip-duration" className="text-sm font-medium">Duration (minutes) <span className="text-muted-foreground">— optional</span></label>
      <Input ref={durationRef} id="trip-duration" inputMode="decimal" className="mt-1 h-12" value={duration} aria-invalid={!!errors.duration} aria-describedby={errors.duration ? "trip-duration-error" : undefined} onChange={e => { setDuration(e.target.value); setFeedback(""); }} />
      {errors.duration && <p id="trip-duration-error" role="alert" className="mt-1 text-sm text-destructive">{errors.duration}</p>}
    </div>
    {([{ field: "bait", label: "Bait or lure" }, { field: "technique", label: "Technique" }] as const).map(({ field, label }) => <div key={field}><label htmlFor={`trip-${field}`} className="text-sm font-medium">{label} <span className="text-muted-foreground">— optional</span></label><Input id={`trip-${field}`} className="mt-1 h-12" maxLength={200} value={draft[field] ?? ""} onChange={e => update({ [field]: e.target.value || undefined })} /></div>)}
    <div><label htmlFor="trip-notes" className="text-sm font-medium">Notes <span className="text-muted-foreground">— optional</span></label><Textarea id="trip-notes" className="mt-1" value={draft.notes ?? ""} onChange={e => update({ notes: e.target.value || undefined })} /></div>
    {saveError && <p role="alert" className="text-sm text-destructive">{saveError} Your draft is still here; retry below.</p>}
    {feedback && <p role="status" className="text-sm text-primary">{feedback}</p>}
    <Button type="submit" disabled={saving} className="h-14 w-full text-base">{saving ? "Saving…" : "Save trip"}</Button>
  </form>;
}