import { z } from "zod";
import { loadSettings, migrateSettings, saveSettings, type ReminderSettings } from "./reminders";

export type Catch = {
  id: string;
  photo: Blob;
  date: string; // YYYY-MM-DD (confirmed by user)
  time: string | null; // HH:MM
  lat: number | null;
  lng: number | null;
  place: string;
  species: string;
  notes: string;
  // Optional structured details, added later — absent on older records and never inferred.
  bait?: string | undefined;
  technique?: string | undefined;
  weightKg?: number | undefined;
  lengthCm?: number | undefined;
  dateSource: "photo" | "manual";
  locationSource: "photo" | "device" | "manual" | "none";
  createdAt: number;
};

const DB = "catchback";
const STORE = "catches";
const TRIPS = "trips";
export const tripSchema = z.object({
  id: z.string().trim().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
    const d = new Date(`${value}T00:00:00Z`);
    return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
  }),
  outcome: z.enum(["caught", "none"]),
  spot: z.string().max(200).optional(),
  durationMinutes: z.number().finite().positive().optional(),
  bait: z.string().max(200).optional(), technique: z.string().max(200).optional(),
  notes: z.string().optional(), createdAt: z.number().finite().nonnegative(),
});
export type Trip = z.infer<typeof tripSchema>;
export type BackupCounts = { catches: number; trips: number };
export function tripStorageError(error: unknown, action = "save") {
  if (error instanceof Error && error.name === "UpgradeBlockedError") return error.message;
  return storageError(error, action).replaceAll("your catches", "your trips").replaceAll("Your catch", "Your trip");
}
export const CHANGED = "catchback-changed";

export function storageError(error: unknown, action = "save"): string {
  if (error instanceof Error && error.name === "UpgradeBlockedError") return error.message;
  const name = typeof error === "object" && error !== null && "name" in error ? error.name : "";
  if (name === "QuotaExceededError") return "Device storage is full. Free some space and try again. Your catch has not been confirmed saved.";
  return `Couldn't ${action} your catches in this browser. Your existing data has not been deleted. Check browser storage permissions and try again.`;
}

export async function protectStorage(): Promise<boolean> {
  try {
    if (!navigator.storage) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch { return false; }
}

function transactionFor(db: IDBDatabase, mode: IDBTransactionMode, stores: string | string[] = STORE): IDBTransaction {
  if (mode === "readonly") return db.transaction(stores, mode);
  try { return db.transaction(stores, mode, { durability: "strict" }); }
  catch (error) {
    // Older browsers do not support the options argument. Never retry actual storage failures.
    if (error instanceof TypeError) return db.transaction(stores, mode);
    throw error;
  }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 2);
    let blocked = false;
    req.onblocked = () => { blocked = true; const error = new Error("Close other CatchBack tabs, then retry. Browser storage needs an update; your existing data has not been deleted."); error.name = "UpgradeBlockedError"; reject(error); };
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: "id" });
      if (!req.result.objectStoreNames.contains(TRIPS)) req.result.createObjectStore(TRIPS, { keyPath: "id" });
    };
    req.onsuccess = () => {
      if (blocked) { req.result.close(); return; }
      req.result.onversionchange = () => req.result.close();
      resolve(req.result);
    };
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>, store = STORE): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    let transaction: IDBTransaction;
    try { transaction = transactionFor(db, mode, store); }
    catch (error) { db.close(); reject(error); return; }
    let r: IDBRequest<T>;
    transaction.oncomplete = () => { db.close(); resolve(r.result); };
    transaction.onabort = () => { db.close(); reject(transaction.error ?? new Error("Couldn't save on this device")); };
    transaction.onerror = () => { /* The abort handler reports failed transactions. */ };
    try { r = fn(transaction.objectStore(store)); }
    catch (error) { transaction.abort(); db.close(); reject(error); }
  });
}

export const getAllCatches = () => tx<Catch[]>("readonly", (s) => s.getAll());
export const getCatch = (id: string) => tx<Catch | undefined>("readonly", (s) => s.get(id));
export async function saveCatch(c: Catch) {
  const protectedStorage = await protectStorage();
  await tx("readwrite", (s) => s.put(c));
  // A completed write is not enough: confirm a fresh read includes the photo bytes.
  const stored = await getCatch(c.id);
  if (!stored || !(stored.photo instanceof Blob)) throw new Error("The saved catch could not be verified. Keep this photo and try saving again.");
  const { photo: originalPhoto, ...original } = c;
  const { photo: storedPhoto, ...details } = stored;
  const a = new Uint8Array(await originalPhoto.arrayBuffer());
  const b = new Uint8Array(await storedPhoto.arrayBuffer());
  if (JSON.stringify(original) !== JSON.stringify(details) || originalPhoto.type !== storedPhoto.type ||
      a.length !== b.length || !a.every((byte, i) => byte === b[i])) {
    throw new Error("The saved catch or photo could not be verified. Keep this photo and try saving again.");
  }
  window.dispatchEvent(new Event(CHANGED));
  return protectedStorage;
}
export async function deleteCatch(id: string) {
  await tx("readwrite", (s) => s.delete(id));
  window.dispatchEvent(new Event(CHANGED));
}

function blobToDataUrl(b: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(b);
  });
}

/** Both stores are read in one transaction before photo encoding starts. */
async function snapshot(): Promise<{ catches: Catch[]; trips: Trip[] }> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    let t: IDBTransaction;
    try { t = transactionFor(db, "readonly", [STORE, TRIPS]); }
    catch (error) { db.close(); reject(error); return; }
    const catches = t.objectStore(STORE).getAll();
    const trips = t.objectStore(TRIPS).getAll();
    t.oncomplete = () => { db.close(); resolve({ catches: catches.result, trips: trips.result }); };
    t.onabort = () => { db.close(); reject(t.error); };
  });
}
export const getAllTrips = () => tx<Trip[]>("readonly", s => s.getAll(), TRIPS);
export const getTrip = (id: string) => tx<Trip | undefined>("readonly", s => s.get(id), TRIPS);
export async function saveTrip(trip: Trip) {
  tripSchema.parse(trip);
  const protectedStorage = await protectStorage();
  await tx("readwrite", s => s.put(trip), TRIPS);
  const stored = await getTrip(trip.id);
  if (!stored || JSON.stringify(stored) !== JSON.stringify(trip)) throw new Error("The saved trip could not be verified. Please retry.");
  window.dispatchEvent(new Event(CHANGED));
  return protectedStorage;
}
export async function deleteTrip(id: string) {
  await tx("readwrite", s => s.delete(id), TRIPS);
  window.dispatchEvent(new Event(CHANGED));
}
export async function exportBackup(): Promise<Blob> {
  const all = await snapshot();
  const catches = await Promise.all(all.catches.map(async (c) => ({ ...c, photo: await blobToDataUrl(c.photo) })));
  return new Blob([JSON.stringify({ app: "CatchBack", version: 3, exportedAt: new Date().toISOString(), catches, trips: all.trips, reminders: loadSettings() })], { type: "application/json" });
}


const backupCatchSchema = z.object({
  id: z.string().trim().min(1),
  photo: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
    const d = new Date(`${value}T00:00:00Z`);
    return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
  }),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),
  lat: z.number().finite().min(-90).max(90).nullable(),
  lng: z.number().finite().min(-180).max(180).nullable(),
  place: z.string(), species: z.string(), notes: z.string(),
  // Optional details: absent is fine (older backups), but a supplied value must be valid —
  // an invalid measurement rejects the whole file rather than being silently stripped.
  bait: z.string().max(200).optional(),
  technique: z.string().max(200).optional(),
  weightKg: z.number().finite().positive().optional(),
  lengthCm: z.number().finite().positive().optional(),
  dateSource: z.enum(["photo", "manual"]),
  locationSource: z.enum(["photo", "device", "manual", "none"]),
  createdAt: z.number().finite().nonnegative(),
});

function restorePhoto(value: string): Blob {
  const match = /^data:(image\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/]+={0,2})$/i.exec(value);
  const mime = match?.[1]?.toLowerCase();
  const encoded = match?.[2];
  if (!mime || !encoded || encoded.length % 4 !== 0) throw new Error("Invalid photo");
  const binary = atob(encoded);
  if (btoa(binary) !== encoded) throw new Error("Invalid photo");
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  const starts = (...signature: number[]) => signature.every((byte, i) => bytes[i] === byte);
  const ascii = (start: number, end: number) => binary.slice(start, end);
  const valid = (
    mime === "image/png" && starts(137, 80, 78, 71, 13, 10, 26, 10) && bytes.length > 24 ||
    ["image/jpeg", "image/jpg"].includes(mime) && starts(255, 216, 255) && bytes.length > 4 ||
    mime === "image/gif" && ["GIF87a", "GIF89a"].includes(ascii(0, 6)) && bytes.length > 13 ||
    mime === "image/webp" && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP" && bytes.length > 20 ||
    mime === "image/bmp" && ascii(0, 2) === "BM" && bytes.length > 54 ||
    mime === "image/tiff" && (starts(73, 73, 42, 0) || starts(77, 77, 0, 42)) && bytes.length > 8 ||
    ["image/heic", "image/heif", "image/avif"].includes(mime) && ascii(4, 8) === "ftyp" &&
      ["heic", "heix", "hevc", "hevx", "mif1", "msf1", "avif", "avis"].includes(ascii(8, 12)) && bytes.length > 24
  );
  if (!valid) throw new Error("Invalid or unsupported photo");
  return new Blob([bytes], { type: mime });
}

async function verifyPhoto(photo: Blob): Promise<void> {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(photo);
    try {
      if (!bitmap.width || !bitmap.height) throw new Error("Invalid photo");
    } finally { bitmap.close(); }
    return;
  }
  const url = URL.createObjectURL(photo);
  try {
    await new Promise<void>((resolve, reject) => {
      const image = new Image();
      image.onload = () => image.naturalWidth && image.naturalHeight ? resolve() : reject(new Error("Invalid photo"));
      image.onerror = () => reject(new Error("Unsupported or invalid photo"));
      image.src = url;
    });
  } finally { URL.revokeObjectURL(url); }
}

async function sameCatch(a: Catch, b: Catch): Promise<boolean> {
  const { photo: photoA, ...detailsA } = a;
  const { photo: photoB, ...detailsB } = b;
  if (JSON.stringify(detailsA) !== JSON.stringify(detailsB) || photoA.type !== photoB.type || photoA.size !== photoB.size) return false;
  const [bytesA, bytesB] = await Promise.all([photoA.arrayBuffer(), photoB.arrayBuffer()]);
  const right = new Uint8Array(bytesB);
  return new Uint8Array(bytesA).every((byte, index) => byte === right[index]);
}

/** Validate everything before opening a write transaction. No photo URLs are fetched. */
export async function readBackup(file: Pick<File, "text">): Promise<{ catches: Catch[]; trips: Trip[]; reminders?: ReminderSettings }> {
  let data: unknown;
  try { data = JSON.parse(await file.text()); }
  catch { throw new Error("Couldn't read this backup. No catches were changed. No trips were changed."); }
  const envelope = z.discriminatedUnion("version", [
    z.object({ app: z.literal("CatchBack"), version: z.literal(1), catches: z.array(z.unknown()) }),
    z.object({ app: z.literal("CatchBack"), version: z.literal(2), catches: z.array(z.unknown()), trips: z.array(z.unknown()) }),
    z.object({ app: z.literal("CatchBack"), version: z.literal(3), catches: z.array(z.unknown()), trips: z.array(z.unknown()), reminders: z.unknown() }),
  ]).safeParse(data);
  if (!envelope.success) throw new Error("Not a supported CatchBack backup (version 1, 2 or 3). No catches were changed. No trips were changed.");
  const ids = new Set<string>();
  const catches: Catch[] = [];
  for (const [index, raw] of envelope.data.catches.entries()) {
    try {
      const c = backupCatchSchema.parse(raw);
      if (ids.has(c.id)) throw new Error("Duplicate catch ID");
      ids.add(c.id);
      const photo = restorePhoto(c.photo);
      await verifyPhoto(photo);
      catches.push({ ...c, photo });
    } catch { throw new Error(`Catch ${index + 1} has invalid details or an unsupported photo. No catches were changed. No trips were changed.`); }
  }
  const trips: Trip[] = [];
  const tripIds = new Set<string>();
  for (const [index, raw] of (envelope.data.version === 1 ? [] : envelope.data.trips).entries()) {
    try {
      const trip = tripSchema.parse(raw);
      if (tripIds.has(trip.id)) throw new Error("Duplicate trip ID");
      tripIds.add(trip.id); trips.push(trip);
    } catch { throw new Error(`Trip ${index + 1} has invalid details. No catches were changed. No trips were changed.`); }
  }
  let reminders: ReminderSettings | undefined;
  if (envelope.data.version === 3) {
    // Accepts the current customizable format and migrates the older fixed 7/3/0 format.
    const migrated = migrateSettings(envelope.data.reminders);
    if (!migrated) throw new Error("Reminder settings in this backup are invalid. No catches were changed. No trips were changed.");
    reminders = migrated;
  }
  return reminders ? { catches, trips, reminders } : { catches, trips };
}

export async function importBackup(
  file: Pick<File, "text">,
  confirmReplace?: (counts: BackupCounts) => boolean | Promise<boolean>,
): Promise<BackupCounts | null> {
  const incoming = await readBackup(file);
  const existing = await snapshot();
  const catchIds = new Set(incoming.catches.map(c => c.id));
  const tripIds = new Set(incoming.trips.map(t => t.id));
  const approvedCatches = new Map(existing.catches.filter(c => catchIds.has(c.id)).map(c => [c.id, c]));
  const approvedTrips = new Map(existing.trips.filter(t => tripIds.has(t.id)).map(t => [t.id, t]));
  const counts = { catches: approvedCatches.size, trips: approvedTrips.size };
  if ((counts.catches || counts.trips) && (!confirmReplace || !await confirmReplace(counts))) return null;
  await protectStorage();
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    let transaction: IDBTransaction;
    try { transaction = transactionFor(db, "readwrite", [STORE, TRIPS]); }
    catch (error) { db.close(); reject(error); return; }
    const store = transaction.objectStore(STORE);
    const tripStore = transaction.objectStore(TRIPS);
    let failure: unknown;
    const changed = () => new Error("Saved catches changed or saved trips changed while importing. No catches were changed. No trips were changed. Please select the backup again.");
    transaction.oncomplete = () => { db.close(); resolve(); };
    transaction.onabort = () => {
      db.close();
      const reason = typeof failure === "object" && failure !== null && "message" in failure ? ` ${String(failure.message)}` : "";
      reject(new Error(`Couldn't restore this backup. No catches were changed. No trips were changed.${reason} Check device storage and retry.`));
    };
    const checkCatches = store.getAll();
    const checkTrips = tripStore.getAll();
    // The last initial read starts comparison; keep this same write transaction alive
    // through asynchronous photo-byte comparisons. No concurrent check/write gap.
    checkTrips.onsuccess = () => {
      let comparing = true;
      let unchanged: boolean[] = [];
      const current = checkCatches.result as Catch[];
      const currentTrips = checkTrips.result as Trip[];
      const keepAlive = () => {
        if (!comparing) {
          try {
            if (failure) throw failure;
            const missing = [...approvedCatches.keys()].some(id => !current.some(c => c.id === id)) ||
              [...approvedTrips.keys()].some(id => !currentTrips.some(t => t.id === id));
            const tripConflict = currentTrips.filter(t => tripIds.has(t.id)).some(t =>
              !approvedTrips.has(t.id) || JSON.stringify(approvedTrips.get(t.id)) !== JSON.stringify(t));
            if (missing || tripConflict || unchanged.some(value => !value)) throw changed();
            for (const c of incoming.catches) store.put(c);
            for (const t of incoming.trips) tripStore.put(t);
          } catch (error) { failure = error; transaction.abort(); }
          return;
        }
        const request = store.get("catchback-import-keepalive");
        request.onsuccess = keepAlive;
      };
      keepAlive();
      Promise.all(current.filter(c => catchIds.has(c.id)).map(async c => {
        const approved = approvedCatches.get(c.id);
        return approved ? sameCatch(approved, c) : false;
      })).then(results => { unchanged = results; comparing = false; })
        .catch(error => { failure = error; comparing = false; });
    };
  });
  // Reminder settings live outside the stores; apply them only after the restore committed.
  if (incoming.reminders) saveSettings(incoming.reminders);
  window.dispatchEvent(new Event(CHANGED));
  return { catches: incoming.catches.length, trips: incoming.trips.length };
}
