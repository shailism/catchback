import { beforeEach, describe, expect, it, vi } from "vitest";
import { IDBFactory, IDBObjectStore } from "fake-indexeddb";
import { Blob as CloneableBlob } from "node:buffer";
import { exportBackup, getAllCatches, importBackup, readBackup, saveCatch, type Catch } from "@/lib/db";
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from "@/lib/reminders";

const photo = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aV1sAAAAASUVORK5CYII=";
const row = (id: string) => ({ id, photo, date: "2025-10-11", time: "06:15", lat: 34.12345, lng: 33.15432,
  place: "Disposable spot", species: "Pilot catch", notes: "Original", dateSource: "manual", locationSource: "manual", createdAt: 1 });
const file = (catches: unknown[], version = 1) => ({ text: async () => JSON.stringify({ app: "CatchBack", version, catches }) });
const saved = async (id: string): Promise<Catch> => {
  const c = (await readBackup(file([row(id)]))).catches[0];
  if (!c) throw new Error("Missing fixture");
  return c;
};

beforeEach(() => {
  vi.stubGlobal("indexedDB", new IDBFactory());
  // fake-indexeddb uses Node's structuredClone, which cannot clone jsdom's Blob.
  vi.stubGlobal("Blob", CloneableBlob);
  // Production export uses FileReader; jsdom's FileReader cannot read node:buffer Blobs,
  // so the test boundary provides an equivalent reader for the stubbed Blob.
  vi.stubGlobal("FileReader", class {
    result: string | null = null;
    onload: (() => void) | null = null;
    onerror: ((e: unknown) => void) | null = null;
    readAsDataURL(b: Blob) {
      b.arrayBuffer().then((buf) => {
        let binary = "";
        for (const byte of new Uint8Array(buf)) binary += String.fromCharCode(byte);
        this.result = `data:${b.type || "application/octet-stream"};base64,${btoa(binary)}`;
        this.onload?.();
      }, (e) => this.onerror?.(e));
    }
  });
  vi.restoreAllMocks();
  vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ width: 1, height: 1, close: vi.fn() })));
});

describe("safe manual backup imports", () => {
  it("validates the entire backup before changing existing catches", async () => {
    await saveCatch(await saved("existing"));
    const before = await getAllCatches();
    await expect(importBackup(file([row("new"), { ...row("bad"), date: "2025-02-30" }]))).rejects.toThrow("No catches were changed");
    expect(await getAllCatches()).toEqual(before);
  });

  it("rejects unsupported backup versions", async () => {
    await expect(importBackup(file([row("a")], 4))).rejects.toThrow("version 1, 2 or 3");
    expect(await getAllCatches()).toEqual([]);
  });

  it.each(["https://example.com/photo.png", "data:image/png;base64,YWJjZA==", "data:image/png;base64,!!!!"])("rejects invalid photo data without fetching URLs: %s", async (value) => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await expect(importBackup(file([{ ...row("a"), photo: value }]))).rejects.toThrow("No catches were changed");
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(await getAllCatches()).toEqual([]);
  });

  it("rejects duplicate IDs within a backup", async () => {
    await expect(importBackup(file([row("a"), row("a")]))).rejects.toThrow("No catches were changed");
    expect(await getAllCatches()).toEqual([]);
  });

  it("restores catches and embedded photo bytes", async () => {
    expect(await importBackup(file([row("a"), row("b")]))).toEqual({ catches: 2, trips: 0 });
    const catches = await getAllCatches();
    expect(catches.map((c) => c.id)).toEqual(["a", "b"]);
    expect(catches[0]?.photo.type).toBe("image/png");
    expect(catches[0]?.photo.size).toBe(atob(photo.split(",")[1] ?? "").length);
    const restored = catches[0]?.photo;
    if (!restored) throw new Error("Missing restored photo");
    expect(Array.from(new Uint8Array(await restored.arrayBuffer()))).toEqual(
      Array.from(atob(photo.split(",")[1] ?? ""), (char) => char.charCodeAt(0)),
    );
  });

  it("cancelling replacement leaves all existing catches and new additions unchanged", async () => {
    await saveCatch({ ...await saved("a"), notes: "Newer edit" });
    const before = await getAllCatches();
    const confirm = vi.fn(() => false);
    expect(await importBackup(file([row("a"), row("b")]), confirm)).toBeNull();
    expect(confirm).toHaveBeenCalledWith({ catches: 1, trips: 0 });
    expect(await getAllCatches()).toEqual(before);
  });

  it("never replaces matching IDs without confirmation", async () => {
    await saveCatch({ ...await saved("a"), notes: "Newer edit" });
    expect(await importBackup(file([row("a")]))).toBeNull();
    expect((await getAllCatches())[0]?.notes).toBe("Newer edit");
  });

  it("approved replacement does not duplicate or change unrelated catches", async () => {
    await saveCatch({ ...await saved("a"), notes: "Newer edit" });
    await saveCatch(await saved("unrelated"));
    const confirm = vi.fn(() => true);
    expect(await importBackup(file([row("a"), row("b")]), confirm)).toEqual({ catches: 2, trips: 0 });
    const catches = await getAllCatches();
    expect(catches.map((c) => c.id)).toEqual(["a", "b", "unrelated"]);
    expect(catches.find((c) => c.id === "a")?.notes).toBe("Original");
    expect(catches.find((c) => c.id === "unrelated")?.notes).toBe("Original");
  });

  it("rolls back the entire restore if a later write fails", async () => {
    await saveCatch(await saved("existing"));
    const before = await getAllCatches();
    const originalPut = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (this: IDBObjectStore, value, key) {
      if (value.id === "b") throw new DOMException("Disposable write failure", "QuotaExceededError");
      return originalPut.call(this, value, key);
    });
    await expect(importBackup(file([row("a"), row("b")]))).rejects.toThrow("Disposable write failure");
    expect(await getAllCatches()).toEqual(before);
  });

  it("does not overwrite a new conflict created while confirmation was open", async () => {
    await saveCatch(await saved("a"));
    await expect(importBackup(file([row("a"), row("b")]), async () => {
      await saveCatch({ ...await saved("b"), notes: "Added during confirmation" });
      return true;
    })).rejects.toThrow("Saved catches changed");
    expect((await getAllCatches()).find((c) => c.id === "b")?.notes).toBe("Added during confirmation");
  });

  it("rejects an undecodable photo before replacing an existing catch", async () => {
    await saveCatch(await saved("a"));
    const before = await getAllCatches();
    vi.mocked(createImageBitmap).mockRejectedValueOnce(new DOMException("Invalid image", "InvalidStateError"));
    const signatureOnly = "data:image/png;base64," + btoa(String.fromCharCode(137, 80, 78, 71, 13, 10, 26, 10) + "x".repeat(32));
    await expect(importBackup(file([{ ...row("a"), photo: signatureOnly }]), () => true)).rejects.toThrow("No catches were changed");
    expect(await getAllCatches()).toEqual(before);
  });

  it("preserves edits to an approved catch made during confirmation", async () => {
    await saveCatch(await saved("a"));
    await expect(importBackup(file([row("a"), row("b")]), async () => {
      await saveCatch({ ...await saved("a"), notes: "Edited during confirmation" });
      return true;
    })).rejects.toThrow("Saved catches changed");
    expect((await getAllCatches()).map((c) => [c.id, c.notes])).toEqual([["a", "Edited during confirmation"]]);
  });

  it("preserves photo changes to an approved catch made during confirmation", async () => {
    await saveCatch(await saved("a"));
    const changedPhoto = new Blob(["Changed photo bytes"], { type: "image/png" });
    await expect(importBackup(file([row("a")]), async () => {
      await saveCatch({ ...await saved("a"), photo: changedPhoto });
      return true;
    })).rejects.toThrow("Saved catches changed");
    expect(await (await getAllCatches())[0]?.photo.text()).toBe("Changed photo bytes");
  });
});

describe("optional fishing details in backups", () => {
  const detailed = (id: string) => ({ ...row(id), bait: "Lugworm", technique: "Float fishing", weightKg: 1.25, lengthCm: 45.5 });

  it("old version-1 backups without the new fields remain valid", async () => {
    expect(await importBackup(file([row("old")]))).toEqual({ catches: 1, trips: 0 });
    const c = (await getAllCatches())[0];
    expect(c?.bait).toBeUndefined();
    expect(c?.technique).toBeUndefined();
    expect(c?.weightKg).toBeUndefined();
    expect(c?.lengthCm).toBeUndefined();
  });

  it("restores supplied bait, technique and measurements", async () => {
    expect(await importBackup(file([detailed("a")]))).toEqual({ catches: 1, trips: 0 });
    const c = (await getAllCatches())[0];
    expect(c?.bait).toBe("Lugworm");
    expect(c?.technique).toBe("Float fishing");
    expect(c?.weightKg).toBe(1.25);
    expect(c?.lengthCm).toBe(45.5);
  });

  it.each([
    ["zero weight", { weightKg: 0 }],
    ["negative weight", { weightKg: -0.5 }],
    ["text weight", { weightKg: "1.2" }],
    ["zero length", { lengthCm: 0 }],
    ["negative length", { lengthCm: -10 }],
    ["text length", { lengthCm: "45" }],
  ])("rejects the whole file for %s without stripping it silently", async (_label, patch) => {
    await saveCatch(await saved("existing"));
    const before = await getAllCatches();
    await expect(importBackup(file([{ ...detailed("a"), ...patch }]))).rejects.toThrow("No catches were changed");
    expect(await getAllCatches()).toEqual(before);
  });

  it("export and import round-trip the new fields", async () => {
    const c = await saved("a");
    await saveCatch({ ...c, bait: "Soft plastic shad", technique: "Spinning", weightKg: 2.5, lengthCm: 60 });
    const exported = await exportBackup();
    vi.stubGlobal("indexedDB", new IDBFactory());
    expect(await importBackup({ text: () => exported.text() })).toEqual({ catches: 1, trips: 0 });
    const restored = (await getAllCatches())[0];
    expect([restored?.bait, restored?.technique, restored?.weightKg, restored?.lengthCm]).toEqual(["Soft plastic shad", "Spinning", 2.5, 60]);
  });

  it("export and import round-trip catches that never had the new fields", async () => {
    await saveCatch(await saved("plain"));
    const exported = await exportBackup();
    vi.stubGlobal("indexedDB", new IDBFactory());
    expect(await importBackup({ text: () => exported.text() })).toEqual({ catches: 1, trips: 0 });
    const restored = (await getAllCatches())[0];
    expect(restored?.weightKg).toBeUndefined();
    expect(restored?.notes).toBe("Original");
  });
});
describe("reminder settings in backups", () => {
  const custom = { master: false, prefs: DEFAULT_SETTINGS.prefs.map((p) => (p.id === "week" ? { ...p, daysBefore: 10 } : p)), mutedCatchIds: ["a"] };
  const fileV3 = (catches: unknown[], reminders: unknown) => ({ text: async () => JSON.stringify({ app: "CatchBack", version: 3, catches, trips: [], reminders }) });

  it("export writes a version-3 envelope including reminder settings", async () => {
    localStorage.clear();
    saveSettings(custom);
    await saveCatch(await saved("a"));
    const exported = JSON.parse(await (await exportBackup()).text());
    expect(exported.version).toBe(3);
    expect(exported.reminders).toEqual(custom);
  });

  it("version-3 import restores reminder settings", async () => {
    localStorage.clear();
    expect(await importBackup(fileV3([row("a")], custom))).toEqual({ catches: 1, trips: 0 });
    expect(loadSettings()).toEqual(custom);
  });

  it("version-3 backups with the older fixed 7/3/0 reminder format are migrated on import", async () => {
    localStorage.clear();
    const legacy = {
      master: true,
      prefs: [
        { id: "week", label: "A week before", daysBefore: 10, enabled: true },
        { id: "three", label: "A few days before", daysBefore: 3, enabled: false },
        { id: "day", label: "On the anniversary", daysBefore: 0, enabled: true },
      ],
      mutedCatchIds: ["a"],
    };
    expect(await importBackup(fileV3([row("a")], legacy))).toEqual({ catches: 1, trips: 0 });
    const restored = loadSettings();
    expect(restored.master).toBe(true);
    expect(restored.mutedCatchIds).toEqual(["a"]);
    expect(restored.prefs.map((p) => [p.daysBefore, p.time, p.enabled])).toEqual([[10, "09:00", true], [3, "09:00", false], [0, "09:00", true]]);
  });

  it("version-1 and version-2 imports leave existing reminder settings unchanged", async () => {
    localStorage.clear();
    saveSettings(custom);
    expect(await importBackup(file([row("a")]))).toEqual({ catches: 1, trips: 0 });
    expect(loadSettings()).toEqual(custom);
    expect(await importBackup({ text: async () => JSON.stringify({ app: "CatchBack", version: 2, catches: [row("b")], trips: [] }) })).toEqual({ catches: 1, trips: 0 });
    expect(loadSettings()).toEqual(custom);
  });

  it("invalid reminder settings reject the whole file before any write", async () => {
    localStorage.clear();
    saveSettings(custom);
    await saveCatch(await saved("existing"));
    const before = await getAllCatches();
    const bad = { ...custom, prefs: custom.prefs.map((p) => (p.id === "week" ? { ...p, daysBefore: 99 } : p)) };
    await expect(importBackup(fileV3([row("a")], bad))).rejects.toThrow("No catches were changed");
    expect(await getAllCatches()).toEqual(before);
    expect(loadSettings()).toEqual(custom);
  });

  it("export and import round-trip reminder settings with catches", async () => {
    localStorage.clear();
    saveSettings(custom);
    await saveCatch(await saved("a"));
    const exported = await exportBackup();
    localStorage.clear();
    vi.stubGlobal("indexedDB", new IDBFactory());
    expect(await importBackup({ text: () => exported.text() })).toEqual({ catches: 1, trips: 0 });
    expect(loadSettings()).toEqual(custom);
  });
});
