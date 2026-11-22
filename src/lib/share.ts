import type { Catch } from "./db";
import { isNativeApp, shareFilesNative } from "./native-files";

/** What the user chose to include. Location fields are off by default. */
export type ShareOptions = {
  photo: boolean; species: boolean; weight: boolean; length: boolean;
  date: boolean; bait: boolean; technique: boolean; place: boolean;
};

export const DEFAULT_SHARE: ShareOptions = {
  photo: true, species: true, weight: true, length: true,
  date: true, bait: true, technique: true, place: false,
};

function prettyDate(iso: string) {
  const [y = 0, m = 1, d = 1] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
}

/** Pure caption builder. Never includes coordinates or notes. */
export function buildCaption(c: Catch, o: ShareOptions): string {
  const lines: string[] = [];
  if (o.species && c.species.trim()) lines.push(`🎣 ${c.species.trim()}`);
  const size: string[] = [];
  if (o.weight && c.weightKg !== undefined) size.push(`${c.weightKg} kg`);
  if (o.length && c.lengthCm !== undefined) size.push(`${c.lengthCm} cm`);
  if (size.length) lines.push(size.join(" · "));
  if (o.bait && c.bait?.trim()) lines.push(`Bait/lure: ${c.bait.trim()}`);
  if (o.technique && c.technique?.trim()) lines.push(`Technique: ${c.technique.trim()}`);
  if (o.date && c.date) lines.push(prettyDate(c.date));
  if (o.place && c.place.trim()) lines.push(`📍 ${c.place.trim()}`);
  lines.push("Logged with CatchBack");
  return lines.join("\n");
}

/** Redraws the photo on a canvas and re-encodes it as JPEG, which drops all EXIF (including GPS). */
export async function renderShareImage(photo: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(photo);
  try {
    const max = 1600;
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Couldn't prepare the image");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((res, rej) => canvas.toBlob(b => b ? res(b) : rej(new Error("Couldn't create the image")), "image/jpeg", 0.9));
  } finally { bitmap.close(); }
}

export type ShareResult = "shared" | "cancelled" | "unsupported";

/** Opens the device share sheet only. Cancelling is reported as cancelled, never as shared. */
export async function shareViaDevice(caption: string, image: Blob | null): Promise<ShareResult> {
  if (isNativeApp()) return shareFilesNative(image ? [{ name: "catch.jpg", blob: image }] : [], caption);
  if (typeof navigator.share !== "function") return "unsupported";
  const data: ShareData = { text: caption };
  if (image) {
    const file = new File([image], "catch.jpg", { type: "image/jpeg" });
    if (!navigator.canShare?.({ files: [file] })) return "unsupported";
    data.files = [file];
  }
  try { await navigator.share(data); return "shared"; }
  catch (e) {
    if ((e as DOMException)?.name === "AbortError") return "cancelled";
    throw e;
  }
}
