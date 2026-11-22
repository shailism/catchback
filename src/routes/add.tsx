import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import exifr from "exifr";
import { Camera, ImageUp } from "lucide-react";
import { toast } from "sonner";
import { CatchForm, type Draft } from "@/components/CatchForm";
import { saveCatch } from "@/lib/db";
import { toIso } from "@/lib/reminders";

export const Route = createFileRoute("/add")({
  head: () => ({
    meta: [
      { title: "Add a catch — CatchBack" },
      { name: "description", content: "Snap or upload a catch photo; CatchBack reads its date, time and location." },
      { property: "og:title", content: "Add a catch — CatchBack" },
      { property: "og:description", content: "Snap or upload a catch photo and log it in seconds." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AddPage,
});

async function readPhoto(file: File): Promise<Draft> {
  let meta: { DateTimeOriginal?: Date; CreateDate?: Date; latitude?: number; longitude?: number } | undefined;
  try {
    meta = await exifr.parse(file, { gps: true, pick: ["DateTimeOriginal", "CreateDate", "GPSLatitude", "GPSLongitude", "GPSLatitudeRef", "GPSLongitudeRef"] });
  } catch {
    meta = undefined;
  }
  const taken = meta?.DateTimeOriginal ?? meta?.CreateDate;
  const valid = taken instanceof Date && !isNaN(taken.getTime());
  const latitude = meta?.latitude;
  const longitude = meta?.longitude;
  const hasGps = typeof latitude === "number" && typeof longitude === "number";
  return {
    photo: file,
    date: valid ? toIso(taken) : "",
    time: valid ? `${String(taken.getHours()).padStart(2, "0")}:${String(taken.getMinutes()).padStart(2, "0")}` : null,
    dateSource: valid ? "photo" : "manual",
    lat: hasGps ? +latitude.toFixed(5) : null,
    lng: hasGps ? +longitude.toFixed(5) : null,
    locationSource: hasGps ? "photo" : "none",
    place: "",
    species: "",
    notes: "",
  };
}

function AddPage() {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [reading, setReading] = useState(false);
  const cam = useRef<HTMLInputElement>(null);
  const up = useRef<HTMLInputElement>(null);
  const saveId = useRef<string | null>(null);
  const navigate = useNavigate();

  const pick = async (f?: File) => {
    if (!f) return;
    setReading(true);
    setDraft(await readPhoto(f));
    setReading(false);
  };

  if (draft)
    return (
      <div className="page">
        <h1 className="page-title">Check the details</h1>
        <p className="mb-4 text-sm text-muted-foreground">We only fill in what the photo contains. Anything missing is left for you.</p>
        <CatchForm
          initial={draft}
          saveLabel="Save catch"
          onSave={async (d) => {
            const id = saveId.current ?? crypto.randomUUID();
            saveId.current = id;
            const protectedStorage = await saveCatch({ ...d, id, createdAt: Date.now() });
            if (protectedStorage) toast.success("Catch and photo saved on this device");
            else toast.warning("Catch and photo saved. Browser storage protection wasn't granted — export a backup before closing.", { duration: 12000 });
            navigate({ to: "/catch/$id", params: { id } });
            return protectedStorage;
          }}
        />
      </div>
    );

  return (
    <div className="page">
      <h1 className="page-title">Add a catch</h1>
      <p className="mb-6 text-muted-foreground">Start with a photo. We'll read its date, time and location if they're saved in it.</p>
      <input ref={cam} type="file" accept="image/*" capture="environment" hidden onChange={(e) => pick(e.target.files?.[0])} />
      <input ref={up} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} />
      <div className="space-y-3">
        <button className="big-action" disabled={reading} onClick={() => cam.current?.click()}>
          <Camera className="size-8" /> Take a photo
        </button>
        <button className="big-action big-action-outline" disabled={reading} onClick={() => up.current?.click()}>
          <ImageUp className="size-8" /> Upload from gallery
        </button>
      </div>
      {reading && <p className="mt-4 text-center text-muted-foreground">Reading photo…</p>}
      <p className="mt-6 rounded-xl bg-secondary p-4 text-sm text-secondary-foreground">
        Tip: original gallery photos usually keep their date and location. Some phones and apps remove them — you can add
        them yourself on the next screen.
      </p>
    </div>
  );
}
