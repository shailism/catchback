import { beforeEach, describe, expect, it, vi } from "vitest";
import { IDBFactory, IDBObjectStore } from "fake-indexeddb";
import { Blob as CloneableBlob } from "node:buffer";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TripForm } from "@/components/TripForm";
import { aggregateTrips } from "@/lib/insights";
import { getAllCatches, getAllTrips, getTrip, saveTrip, importBackup, exportBackup, readBackup, type Trip } from "@/lib/db";

const photo = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aV1sAAAAASUVORK5CYII=";
const catchRow = (id: string) => ({ id, photo, date: "2025-10-11", time: null, lat: null, lng: null, place: "", species: "Test", notes: "", bait: "shrimp", technique: "float", weightKg: 2.5, lengthCm: 45.5, dateSource: "manual", locationSource: "none", createdAt: 1 });
const trip = (id: string): Trip => ({ id, date: "2025-10-12", outcome: "none", spot: "Disposable", durationMinutes: 90.5, bait: "worm", technique: "float", notes: "test only", createdAt: 1 });
const file = (catches: unknown[] = [], trips: unknown[] = [], version = 2) => ({ text: async () => JSON.stringify({ app: "CatchBack", version, catches, ...(version === 1 ? {} : { trips }) }) });
beforeEach(() => {
  cleanup(); vi.restoreAllMocks();
  vi.stubGlobal("indexedDB", new IDBFactory()); vi.stubGlobal("Blob", CloneableBlob);
  vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ width: 1, height: 1, close: vi.fn() })));
  vi.stubGlobal("FileReader", class {
    result: string | null = null; onload: (() => void) | null = null; onerror: (() => void) | null = null;
    readAsDataURL(blob: Blob) { blob.arrayBuffer().then(bytes => { this.result = `data:${blob.type};base64,${Buffer.from(bytes).toString("base64")}`; this.onload?.(); }).catch(() => this.onerror?.()); }
  });
  Object.defineProperty(navigator, "storage", { configurable: true, value: { persisted: async () => true } });
});
describe("additive trip storage and combined backups", () => {
  it("trip summaries count only explicitly logged outcomes and valid duration samples", () => {
    expect(aggregateTrips([])).toEqual({ total: 0, withCatches: 0, withoutCatches: 0, durationSamples: 0 });
    expect(aggregateTrips([{ outcome: "caught", durationMinutes: 45.5 }, { outcome: "none" }, { outcome: "none", durationMinutes: 0 }, { outcome: "caught", durationMinutes: Infinity }])).toEqual({ total: 4, withCatches: 2, withoutCatches: 2, durationSamples: 1 });
  });
  it("export retains the coherent snapshot even if a trip changes during photo encoding", async () => {
    await importBackup(file([catchRow("a")], [trip("a")]));
    vi.stubGlobal("FileReader", class {
      result: string | null = null; onload: (() => void) | null = null;
      readAsDataURL(blob: Blob) { (async () => {
        await saveTrip({ ...trip("a"), notes: "changed after snapshot" });
        this.result = `data:${blob.type};base64,${Buffer.from(await blob.arrayBuffer()).toString("base64")}`; this.onload?.();
      })(); }
    });
    const exported = JSON.parse(await (await exportBackup()).text());
    expect(exported.trips[0].notes).toBe("test only"); expect((await getTrip("a"))?.notes).toBe("changed after snapshot");
  });
  it("upgrades a v1 database without changing old catches or photo bytes", async () => {
    const legacy = { ...catchRow("old"), photo: new Blob(["old-photo"], { type: "image/png" }) };
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open("catchback", 1);
      request.onupgradeneeded = () => request.result.createObjectStore("catches", { keyPath: "id" });
      request.onsuccess = () => { const db = request.result; const t = db.transaction("catches", "readwrite"); t.objectStore("catches").put(legacy); t.oncomplete = () => { db.close(); resolve(); }; };
      request.onerror = () => reject(request.error);
    });
    await saveTrip(trip("trip"));
    const catches = await getAllCatches();
    expect(catches[0]?.id).toBe("old"); expect(await catches[0]?.photo.text()).toBe("old-photo");
    expect((await getAllTrips())[0]?.outcome).toBe("none");
  });
  it("reports blocked upgrades without hanging or deleting legacy data", async () => {
    const db = await new Promise<IDBDatabase>(resolve => {
      const r = indexedDB.open("catchback", 1); r.onupgradeneeded = () => r.result.createObjectStore("catches", { keyPath: "id" }); r.onsuccess = () => resolve(r.result);
    });
    await expect(getAllTrips()).rejects.toThrow("Close other CatchBack tabs"); db.close();
    expect(await getAllTrips()).toEqual([]);
  });
  it("version-1 restores preserve unrelated existing trips", async () => {
    await saveTrip(trip("kept"));
    expect(await importBackup(file([catchRow("old")], [], 1))).toEqual({ catches: 1, trips: 0 });
    expect(await getTrip("kept")).toEqual(trip("kept"));
  });
  it("combined round trip includes photos and all optional fields", async () => {
    await importBackup(file([catchRow("catch")], [trip("trip")]));
    const backup = await exportBackup(); const data = JSON.parse(await backup.text());
    expect(data.version).toBe(3); expect(data.catches[0].photo).toBe(photo); expect(data.trips).toEqual([trip("trip")]);
    vi.stubGlobal("indexedDB", new IDBFactory());
    expect(await importBackup(backup)).toEqual({ catches: 1, trips: 1 });
    expect(await getTrip("trip")).toEqual(trip("trip"));
    const restored = (await getAllCatches())[0];
    expect([restored?.bait, restored?.technique, restored?.weightKg, restored?.lengthCm]).toEqual(["shrimp", "float", 2.5, 45.5]);
    expect(await restored?.photo.arrayBuffer()).toEqual(await (await readBackup(file([catchRow("catch")]))).catches[0]?.photo.arrayBuffer());
  });
  it("cancel changes neither store; approved repeat import avoids duplicates and keeps unrelated records", async () => {
    await importBackup(file([catchRow("a"), catchRow("unrelated")], [trip("a"), trip("unrelated")]));
    const incoming = file([catchRow("a"), catchRow("new")], [trip("a"), trip("new")]);
    const confirm = vi.fn(() => false); expect(await importBackup(incoming, confirm)).toBeNull();
    expect(confirm).toHaveBeenCalledWith({ catches: 1, trips: 1 });
    expect((await getAllCatches()).length).toBe(2); expect((await getAllTrips()).length).toBe(2);
    await importBackup(incoming, () => true); await importBackup(incoming, () => true);
    expect((await getAllCatches()).map(c => c.id)).toEqual(["a", "new", "unrelated"]);
    expect((await getAllTrips()).map(t => t.id)).toEqual(["a", "new", "unrelated"]);
  });
  it.each([0, -1, "10", null])("invalid late duration %s rejects the full file before writes", async durationMinutes => {
    await saveTrip(trip("existing"));
    await expect(importBackup(file([catchRow("new")], [trip("good"), { ...trip("bad"), durationMinutes }]))).rejects.toThrow("Trip 2 has invalid details");
    expect(await getAllCatches()).toEqual([]); expect(await getAllTrips()).toEqual([trip("existing")]);
  });
  it.each([{ date: "2025-02-30" }, { outcome: "" }, { outcome: "unknown" }])("rejects invalid trip date/outcome %j", async patch => {
    await expect(importBackup(file([], [{ ...trip("bad"), ...patch }]))).rejects.toThrow("invalid details"); expect(await getAllTrips()).toEqual([]);
  });
  it("requires both v2 arrays and rejects future versions", async () => {
    await expect(readBackup({ text: async () => JSON.stringify({ app: "CatchBack", version: 2, catches: [] }) })).rejects.toThrow("supported");
    await expect(readBackup(file([], [], 4))).rejects.toThrow("supported");
  });
  it("rejects duplicate trip IDs", async () => {
    await expect(importBackup(file([], [trip("a"), trip("a")]))).rejects.toThrow("Trip 2"); expect(await getAllTrips()).toEqual([]);
  });
  it.each(["edit", "new", "delete"])("aborts both stores for trip %s during confirmation", async operation => {
    await importBackup(file([catchRow("a")], [trip("a")]));
    await expect(importBackup(file([catchRow("a"), catchRow("new")], [trip("a"), trip("new")]), async () => {
      if (operation === "delete") { const { deleteTrip } = await import("@/lib/db"); await deleteTrip("a"); }
      else await saveTrip({ ...trip(operation === "new" ? "new" : "a"), notes: "Concurrent edit" });
      return true;
    })).rejects.toThrow("saved trips changed");
    expect((await getAllCatches()).map(c => c.id)).toEqual(["a"]);
    if (operation !== "delete") expect((await getAllTrips()).find(t => t.id === (operation === "new" ? "new" : "a"))?.notes).toBe("Concurrent edit");
  });
  it("a concurrent catch photo edit aborts trip additions as well", async () => {
    await importBackup(file([catchRow("a")]));
    await expect(importBackup(file([catchRow("a")], [trip("new")]), async () => {
      const { saveCatch } = await import("@/lib/db"); const c = (await getAllCatches())[0]; if (!c) throw new Error("fixture");
      await saveCatch({ ...c, photo: new Blob(["changed"], { type: "image/png" }) }); return true;
    })).rejects.toThrow("Saved catches changed");
    expect(await getAllTrips()).toEqual([]); expect(await (await getAllCatches())[0]?.photo.text()).toBe("changed");
  });
  it("a trip-store write failure rolls back queued catch replacements and additions", async () => {
    await importBackup(file([catchRow("a")], [trip("existing")]));
    const put = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (this: IDBObjectStore, value, key) {
      if (this.name === "trips" && value.id === "fail") throw new DOMException("full", "QuotaExceededError"); return put.call(this, value, key);
    });
    await expect(importBackup(file([{ ...catchRow("a"), notes: "replacement" }, catchRow("new")], [trip("fail")]), () => true)).rejects.toThrow("No trips were changed");
    expect((await getAllCatches()).map(c => [c.id, c.notes])).toEqual([["a", ""]]); expect(await getAllTrips()).toEqual([trip("existing")]);
  });
  it("trip saves verify readback before success", async () => {
    const put = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (this: IDBObjectStore, value) { return put.call(this, { ...value, notes: "altered" }); });
    await expect(saveTrip(trip("a"))).rejects.toThrow("could not be verified");
  });
});
describe("explicit trip form", () => {
  it("requires date then outcome and focuses the visible invalid field", async () => {
    const save = vi.fn(); render(<TripForm initial={{ date: "", outcome: "" }} onSave={save} />);
    expect(screen.getByLabelText("Caught fish")).not.toBeChecked(); expect(screen.getByLabelText("No catches")).not.toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Save trip" })); expect(screen.getByLabelText("Trip date")).toHaveFocus(); expect(save).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Trip date"), { target: { value: "2025-10-12" } });
    fireEvent.click(screen.getByRole("button", { name: "Save trip" })); expect(screen.getByLabelText("Caught fish")).toHaveFocus(); expect(save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText("No catches")); fireEvent.click(screen.getByRole("button", { name: "Save trip" }));
    await waitFor(() => expect(save).toHaveBeenCalledOnce()); expect(save.mock.calls[0]?.[0].outcome).toBe("none"); expect(save.mock.calls[0]?.[0].durationMinutes).toBeUndefined();
  });
  it.each(["0", "-1", "Infinity", "bad"])("invalid duration %s blocks save and focuses its error", value => {
    const save = vi.fn(); render(<TripForm initial={trip("a")} onSave={save} />);
    fireEvent.change(screen.getByLabelText(/Duration/), { target: { value } }); fireEvent.click(screen.getByRole("button", { name: "Save trip" }));
    expect(save).not.toHaveBeenCalled(); expect(screen.getByLabelText(/Duration/)).toHaveFocus(); expect(screen.getByRole("alert")).toHaveTextContent("Duration must be a number greater than 0");
  });
  it("prefills, clears all optional values, and changes the outcome without inventing effort", async () => {
    const save = vi.fn(async (_draft: unknown) => true); render(<TripForm initial={trip("a")} onSave={save} />);
    expect(screen.getByLabelText(/Duration/)).toHaveValue("90.5");
    for (const label of [/Duration/, /Spot name/, /Bait or lure/, /Technique/, /Notes/]) fireEvent.change(screen.getByLabelText(label), { target: { value: "" } });
    fireEvent.click(screen.getByLabelText("Caught fish")); fireEvent.click(screen.getByRole("button", { name: "Save trip" }));
    await waitFor(() => expect(save).toHaveBeenCalledOnce());
    const draft = save.mock.calls[0]?.[0] as unknown as Trip;
    expect(draft.outcome).toBe("caught"); expect([draft.spot, draft.bait, draft.technique, draft.notes, draft.durationMinutes]).toEqual([undefined, undefined, undefined, undefined, undefined]);
  });
  it("accepts a phone decimal comma and reports retryable storage failure", async () => {
    const save = vi.fn().mockRejectedValue(new DOMException("full", "QuotaExceededError")); render(<TripForm initial={trip("a")} onSave={save} />);
    fireEvent.change(screen.getByLabelText(/Duration/), { target: { value: "12,5" } }); fireEvent.click(screen.getByRole("button", { name: "Save trip" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Device storage is full"));
    expect(save.mock.calls[0]?.[0].durationMinutes).toBe(12.5); expect(screen.getByLabelText(/Duration/)).toHaveValue("12,5"); expect(screen.getByRole("button", { name: "Save trip" })).toBeEnabled();
  });
});