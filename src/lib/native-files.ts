// Native (Capacitor) file hand-off for backups and share images. Web code paths
// never call this; it is used only when running inside the app-store build.
import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

export type NativeShareResult = "shared" | "cancelled";
/** Only this cache subfolder is ever written or deleted — never app records (which live in IndexedDB). */
export const SHARE_DIR = "catchback-share";

export const isNativeApp = () => Capacitor.isNativePlatform();

/** The share plugin rejects with a "canceled"/"cancelled" message when the sheet is dismissed. */
export function isShareCancel(error: unknown) {
  const msg = String((error as { message?: unknown })?.message ?? error ?? "");
  return /cancel/i.test(msg);
}

/** Only plain file names inside the share folder; blocks paths escaping it. */
export function safeShareName(name: string) {
  const clean = name.replace(/[^\w.-]+/g, "-").replace(/\.{2,}/g, "").replace(/^[.-]+/, "");
  if (!clean) throw new Error("Invalid file name");
  return clean;
}

function toBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]*,/, ""));
    reader.onerror = () => reject(reader.error ?? new Error("Couldn't read the file"));
    reader.readAsDataURL(blob);
  });
}

/** Removes leftover temporary share files from earlier sessions. Never touches anything else. */
export async function clearShareCache() {
  try { await Filesystem.rmdir({ path: SHARE_DIR, directory: Directory.Cache, recursive: true }); }
  catch { /* Folder absent: nothing to clean. */ }
}

/**
 * Writes temporary copies to the app cache, opens the system share sheet and
 * deletes the copies afterwards. A resolved sheet means the user picked a target;
 * it does not prove the target app finished posting or saving.
 */
export async function shareFilesNative(files: { name: string; blob: Blob }[], text?: string, title?: string): Promise<NativeShareResult> {
  // Receiving apps may read the file after the sheet closes, so earlier copies are
  // cleared before the next share and on app start, not immediately.
  await clearShareCache();
  const uris: string[] = [];
  for (const f of files) {
    const path = `${SHARE_DIR}/${Date.now()}-${safeShareName(f.name)}`;
    const written = await Filesystem.writeFile({ path, directory: Directory.Cache, data: await toBase64(f.blob), recursive: true });
    uris.push(written.uri);
  }
  try {
    await Share.share({ ...(title ? { title, dialogTitle: title } : {}), ...(text ? { text } : {}), ...(uris.length ? { files: uris } : {}) });
    return "shared";
  } catch (error) {
    if (isShareCancel(error)) return "cancelled";
    throw error;
  }
}
