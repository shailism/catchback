import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Catch } from "@/lib/db";
import { storageError } from "@/lib/db";
import { toIso } from "@/lib/reminders";
import { usePhotoUrl } from "@/lib/use-catches";
import { CalendarDays, Clock, MapPin, Fish, Camera, PenLine, Navigation, Scale, Ruler, ChevronDown } from "lucide-react";

export type Draft = Omit<Catch, "id" | "createdAt" | "date" | "dateSource"> & {
  date: string;
  dateSource: Catch["dateSource"];
};

const SPECIES = ["Sea bream", "Sea bass", "Grouper", "Mackerel", "Trout", "Carp", "Pike", "Tuna"];

function Source({ kind }: { kind: "photo" | "device" | "manual" | "missing" }) {
  const map = {
    photo: { t: "From photo", c: "bg-secondary text-secondary-foreground", I: Camera },
    device: { t: "From this phone", c: "bg-secondary text-secondary-foreground", I: Navigation },
    manual: { t: "Entered by you", c: "bg-muted text-muted-foreground", I: PenLine },
    missing: { t: "Not in photo — please add", c: "bg-warning text-warning-foreground", I: PenLine },
  }[kind];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${map.c}`}>
      <map.I className="size-3" /> {map.t}
    </span>
  );
}

/** Empty means unknown (undefined); otherwise a positive finite decimal is required. */
function parseMeasure(text: string): { value?: number | undefined; error?: boolean | undefined } {
  const trimmed = text.trim();
  if (!trimmed) return { value: undefined };
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value <= 0) return { error: true };
  return { value };
}

export function CatchForm({
  initial,
  onSave,
  saveLabel,
}: {
  initial: Draft;
  /** Returns false when browser storage protection wasn't granted; anything else counts as protected/unknown. */
  onSave: (d: Draft) => Promise<boolean | void>;
  saveLabel: string;
}) {
  const [d, setD] = useState<Draft>(initial);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [feedback, setFeedback] = useState("");
  // Measurements are typed as text and only parsed on save, so partial input is never coerced.
  const [weightText, setWeightText] = useState(initial.weightKg != null ? String(initial.weightKg) : "");
  const [lengthText, setLengthText] = useState(initial.lengthCm != null ? String(initial.lengthCm) : "");
  const [measureErrors, setMeasureErrors] = useState<{ weight?: string | undefined; length?: string | undefined }>({});
  const [detailsOpen, setDetailsOpen] = useState(false);
  const weightRef = useRef<HTMLInputElement>(null);
  const lengthRef = useRef<HTMLInputElement>(null);
  const url = usePhotoUrl(d.photo);
  const set = (p: Partial<Draft>) => { setD((x) => ({ ...x, ...p })); setFeedback(""); };

  const useDevice = () => {
    setLocError("");
    if (!navigator.geolocation) return setLocError("Location isn't available on this device.");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        set({ lat: +p.coords.latitude.toFixed(5), lng: +p.coords.longitude.toFixed(5), locationSource: "device" });
        setLocating(false);
      },
      () => {
        setLocError("Couldn't get your location. You can type it instead.");
        setLocating(false);
      },
    );
  };

  return (
    <div className="space-y-5">
      {url && <img src={url} alt="Your catch" className="aspect-[4/3] w-full rounded-2xl object-cover shadow-soft" />}

      <section className="card-panel space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 font-semibold"><CalendarDays className="size-5 text-primary" /> Date</h3>
          <Source kind={!d.date ? "missing" : d.dateSource} />
        </div>
        <Input type="date" className="h-12 text-base" value={d.date} max={toIso(new Date(Date.now() + 86400000))}
          onChange={(e) => set({ date: e.target.value, dateSource: "manual" })} />
        {!d.date && (
          <Button variant="outline" className="h-11 w-full" onClick={() => set({ date: toIso(new Date()), dateSource: "manual" })}>
            It was today
          </Button>
        )}
        <div className="flex items-center justify-between gap-2 pt-1">
          <h3 className="flex items-center gap-2 font-semibold"><Clock className="size-5 text-primary" /> Time <span className="text-xs font-normal text-muted-foreground">optional</span></h3>
          {d.time && <Source kind={d.dateSource === "photo" && initial.time === d.time ? "photo" : "manual"} />}
        </div>
        <Input type="time" className="h-12 text-base" value={d.time ?? ""} onChange={(e) => set({ time: e.target.value || null })} />
      </section>

      <section className="card-panel space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 font-semibold"><MapPin className="size-5 text-primary" /> Location <span className="text-xs font-normal text-muted-foreground">optional</span></h3>
          {d.lat != null ? <Source kind={d.locationSource === "none" ? "manual" : d.locationSource} /> : <Source kind="missing" />}
        </div>
        {d.lat != null && d.lng != null && (
          <a className="block text-sm font-medium text-primary underline" target="_blank" rel="noreferrer"
            href={`https://www.openstreetmap.org/?mlat=${d.lat}&mlon=${d.lng}#map=14/${d.lat}/${d.lng}`}>
            {d.lat}, {d.lng} — view on map
          </a>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Input inputMode="decimal" placeholder="Latitude" className="h-12" value={d.lat ?? ""}
            onChange={(e) => set({ lat: e.target.value === "" ? null : Number(e.target.value), locationSource: "manual" })} />
          <Input inputMode="decimal" placeholder="Longitude" className="h-12" value={d.lng ?? ""}
            onChange={(e) => set({ lng: e.target.value === "" ? null : Number(e.target.value), locationSource: "manual" })} />
        </div>
        <Button variant="outline" className="h-11 w-full" onClick={useDevice} disabled={locating}>
          <Navigation /> {locating ? "Finding you…" : "I'm still at the spot — use my location"}
        </Button>
        {locError && <p className="text-sm text-destructive">{locError}</p>}
        <Input placeholder="Spot name, e.g. Old harbour wall" className="h-12" value={d.place} onChange={(e) => set({ place: e.target.value })} />
      </section>

      <section className="card-panel space-y-3">
        <h3 className="flex items-center gap-2 font-semibold"><Fish className="size-5 text-primary" /> Species <span className="text-xs font-normal text-muted-foreground">optional</span></h3>
        <div className="flex flex-wrap gap-2">
          {SPECIES.map((s) => (
            <button key={s} type="button" onClick={() => set({ species: d.species === s ? "" : s })}
              className={`chip ${d.species === s ? "chip-active" : ""}`}>{s}</button>
          ))}
        </div>
        <Input placeholder="Or type a species" className="h-12" value={d.species} onChange={(e) => set({ species: e.target.value })} />
        <Textarea placeholder="Notes (bait, weather, who you were with…)" value={d.notes} onChange={(e) => set({ notes: e.target.value })} />
      </section>

      <details className="card-panel space-y-3" open={detailsOpen}
        onToggle={(e) => setDetailsOpen(e.currentTarget.open)}>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 font-semibold [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-2"><Scale className="size-5 text-primary" /> Fishing details <span className="text-xs font-normal text-muted-foreground">optional — skip anything</span></span>
          <ChevronDown className="size-5 text-muted-foreground" />
        </summary>
        <div className="space-y-3 pt-1">
          <div>
            <label htmlFor="bait" className="text-sm font-medium">Bait or lure</label>
            <Input id="bait" placeholder="e.g. lugworm, soft plastic shad" className="mt-1 h-12" maxLength={200}
              value={d.bait ?? ""} onChange={(e) => set({ bait: e.target.value })} />
          </div>
          <div>
            <label htmlFor="technique" className="text-sm font-medium">Technique</label>
            <Input id="technique" placeholder="e.g. float fishing, spinning, bottom rig" className="mt-1 h-12" maxLength={200}
              value={d.technique ?? ""} onChange={(e) => set({ technique: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="weight" className="flex items-center gap-1 text-sm font-medium"><Scale className="size-4" /> Weight (kg)</label>
              <Input id="weight" ref={weightRef} inputMode="decimal" placeholder="e.g. 1.2" className="mt-1 h-12" value={weightText}
                aria-invalid={!!measureErrors.weight} aria-describedby={measureErrors.weight ? "weight-error" : undefined}
                onChange={(e) => { setWeightText(e.target.value); setMeasureErrors((m) => ({ ...m, weight: undefined })); }} />
              {measureErrors.weight && <p id="weight-error" role="alert" className="mt-1 text-sm text-destructive">{measureErrors.weight}</p>}
            </div>
            <div>
              <label htmlFor="length" className="flex items-center gap-1 text-sm font-medium"><Ruler className="size-4" /> Length (cm)</label>
              <Input id="length" ref={lengthRef} inputMode="decimal" placeholder="e.g. 45" className="mt-1 h-12" value={lengthText}
                aria-invalid={!!measureErrors.length} aria-describedby={measureErrors.length ? "length-error" : undefined}
                onChange={(e) => { setLengthText(e.target.value); setMeasureErrors((m) => ({ ...m, length: undefined })); }} />
              {measureErrors.length && <p id="length-error" role="alert" className="mt-1 text-sm text-destructive">{measureErrors.length}</p>}
            </div>
          </div>
        </div>
      </details>

      {saveError && <p role="alert" className="rounded-lg bg-warning p-3 text-sm text-warning-foreground">{saveError} Keep your original photo; you can retry below.</p>}
      {feedback && <p role="status" className="rounded-lg bg-secondary p-3 text-sm font-medium text-secondary-foreground">{feedback}</p>}
      <Button size="lg" className="h-14 w-full text-lg" disabled={!d.date || saving}
        onClick={async () => {
          setSaveError("");
          setFeedback("");
          const weight = parseMeasure(weightText);
          const length = parseMeasure(lengthText);
          const errors: { weight?: string; length?: string } = {};
          if (weight.error) errors.weight = "Weight must be a number greater than 0, or left empty.";
          if (length.error) errors.length = "Length must be a number greater than 0, or left empty.";
          setMeasureErrors(errors);
          if (errors.weight || errors.length) {
            // The section may be collapsed: open it and focus the first invalid field.
            setDetailsOpen(true);
            setTimeout(() => (errors.weight ? weightRef : lengthRef).current?.focus(), 0);
            return;
          }
          setSaving(true);
          try {
            const protectedStorage = await onSave({ ...d, weightKg: weight.value, lengthCm: length.value });
            setFeedback(protectedStorage === false
              ? "Saved. Storage protection wasn't granted — export a backup before closing."
              : "Saved on this device.");
          }
          catch (error) { setSaveError(storageError(error)); }
          finally { setSaving(false); }
        }}>
        {!d.date ? "Add a date to save" : saving ? "Saving…" : saveLabel}
      </Button>
    </div>
  );
}
