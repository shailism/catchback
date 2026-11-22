import { beforeEach, describe, expect, it, vi } from "vitest";
import { IDBDatabase, IDBFactory, IDBObjectStore } from "fake-indexeddb";
import { Blob as CloneableBlob } from "node:buffer";
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { CHANGED, getAllCatches, getCatch, protectStorage, saveCatch, type Catch } from "@/lib/db";
import { CatchForm, type Draft } from "@/components/CatchForm";
import { useCatches } from "@/lib/use-catches";

const makeCatch = (): Catch => ({ id: "disposable", photo: new Blob([new Uint8Array([1, 2, 3, 4])], { type: "image/png" }),
  date: "2025-10-11", time: "06:15", lat: null, lng: null, place: "Test spot", species: "Test fish", notes: "Disposable",
  dateSource: "manual", locationSource: "none", createdAt: 1 });

beforeEach(() => {
  cleanup(); vi.restoreAllMocks();
  vi.stubGlobal("indexedDB", new IDBFactory());
  vi.stubGlobal("Blob", CloneableBlob);
  Object.defineProperty(navigator, "storage", { configurable: true, value: { persisted: vi.fn(async () => false), persist: vi.fn(async () => true) } });
});

describe("committed local catches", () => {
  it("requests strict durability and reads committed catch details and all photo bytes", async () => {
    const transaction = vi.spyOn(IDBDatabase.prototype, "transaction");
    const c = makeCatch();
    expect(await saveCatch(c)).toBe(true);
    expect(transaction).toHaveBeenCalledWith("catches", "readwrite", { durability: "strict" });
    const reopened = await getCatch(c.id);
    if (!reopened) throw new Error("Committed catch missing");
    expect(reopened?.date).toBe("2025-10-11");
    expect(reopened?.species).toBe("Test fish");
    expect(Array.from(new Uint8Array(await reopened.photo.arrayBuffer()))).toEqual([1, 2, 3, 4]);
  });

  it("reports a declined persistence request without losing a committed catch", async () => {
    vi.mocked(navigator.storage.persist).mockResolvedValue(false);
    expect(await saveCatch(makeCatch())).toBe(false);
    expect((await getAllCatches()).length).toBe(1);
  });

  it("does not request persistence again when already granted", async () => {
    vi.mocked(navigator.storage.persisted).mockResolvedValue(true);
    expect(await protectStorage()).toBe(true);
    expect(navigator.storage.persist).not.toHaveBeenCalled();
  });

  it("rejects full-storage writes without a success event and preserves existing data", async () => {
    await saveCatch(makeCatch());
    const changed = vi.fn(); window.addEventListener(CHANGED, changed);
    vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(() => { throw new DOMException("Full", "QuotaExceededError"); });
    await expect(saveCatch({ ...makeCatch(), id: "failed" })).rejects.toThrow("Full");
    expect(changed).not.toHaveBeenCalled();
    expect((await getAllCatches()).map(c => c.id)).toEqual(["disposable"]);
    window.removeEventListener(CHANGED, changed);
  });

  it("does not confirm a save when read-back contains altered photo bytes", async () => {
    const put = IDBObjectStore.prototype.put;
    vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (this: IDBObjectStore, value) {
      return put.call(this, { ...value, photo: new Blob([new Uint8Array([4, 3, 2, 1])], { type: "image/png" }) });
    });
    await expect(saveCatch(makeCatch())).rejects.toThrow("could not be verified");
  });

  it("surfaces open failures instead of reporting an empty journal", async () => {
    vi.spyOn(indexedDB, "open").mockImplementation(() => { throw new DOMException("Blocked", "SecurityError"); });
    const { result } = renderHook(() => useCatches());
    await waitFor(() => expect(result.current.error).toContain("Couldn't load"));
    expect(result.current.catches).toBeNull();
  });

  it("reloads committed catches when returning to a tab", async () => {
    const { result } = renderHook(() => useCatches());
    await waitFor(() => expect(result.current.catches).toEqual([]));
    await act(async () => { await saveCatch(makeCatch()); });
    await act(async () => { window.dispatchEvent(new Event("pageshow")); });
    await waitFor(() => expect(result.current.catches?.[0]?.id).toBe("disposable"));
  });

  it("keeps the form retryable and retains the draft when saving fails", async () => {
    const onSave = vi.fn().mockRejectedValue(new DOMException("Full", "QuotaExceededError"));
    const initial: Draft = { ...makeCatch(), photo: undefined as unknown as Blob };
    render(<CatchForm initial={initial} onSave={onSave} saveLabel="Save catch" />);
    fireEvent.click(screen.getByRole("button", { name: "Save catch" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Device storage is full"));
    expect(screen.getByRole("button", { name: "Save catch" })).toBeEnabled();
    expect(screen.getByPlaceholderText("Or type a species")).toHaveValue("Test fish");
    fireEvent.click(screen.getByRole("button", { name: "Save catch" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));
  });
});

describe("optional fishing details in the form", () => {
  const draft = (): Draft => ({ ...makeCatch(), photo: undefined as unknown as Blob });

  it("saves valid bait, technique and measurements", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<CatchForm initial={draft()} onSave={onSave} saveLabel="Save catch" />);
    fireEvent.change(screen.getByLabelText("Bait or lure"), { target: { value: "Lugworm" } });
    fireEvent.change(screen.getByLabelText("Technique"), { target: { value: "Float fishing" } });
    fireEvent.change(screen.getByLabelText("Weight (kg)"), { target: { value: "1.25" } });
    fireEvent.change(screen.getByLabelText("Length (cm)"), { target: { value: "45.5" } });
    fireEvent.click(screen.getByRole("button", { name: "Save catch" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const savedDraft = onSave.mock.calls[0]?.[0] as Draft;
    expect([savedDraft.bait, savedDraft.technique, savedDraft.weightKg, savedDraft.lengthCm]).toEqual(["Lugworm", "Float fishing", 1.25, 45.5]);
  });

  it.each([
    ["Weight (kg)", "0", "Weight must be a number greater than 0"],
    ["Weight (kg)", "-2", "Weight must be a number greater than 0"],
    ["Weight (kg)", "abc", "Weight must be a number greater than 0"],
    ["Length (cm)", "0", "Length must be a number greater than 0"],
    ["Length (cm)", "-10", "Length must be a number greater than 0"],
    ["Length (cm)", "long", "Length must be a number greater than 0"],
  ])("rejects %s = %s with a field-specific message and no save", async (label, value, message) => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<CatchForm initial={draft()} onSave={onSave} saveLabel="Save catch" />);
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
    fireEvent.click(screen.getByRole("button", { name: "Save catch" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(message));
    expect(onSave).not.toHaveBeenCalled();
  });

  it("treats empty measurements as unknown, never zero", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<CatchForm initial={draft()} onSave={onSave} saveLabel="Save catch" />);
    fireEvent.click(screen.getByRole("button", { name: "Save catch" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const savedDraft = onSave.mock.calls[0]?.[0] as Draft;
    expect(savedDraft.weightKg).toBeUndefined();
    expect(savedDraft.lengthCm).toBeUndefined();
  });

  it("opens the collapsed section and focuses the first invalid measurement on save", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<CatchForm initial={draft()} onSave={onSave} saveLabel="Save catch" />);
    const details = container.querySelector("details");
    expect(details?.open).toBe(false);
    fireEvent.change(screen.getByLabelText("Weight (kg)"), { target: { value: "abc" } });
    fireEvent.click(screen.getByRole("button", { name: "Save catch" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Weight must be a number greater than 0"));
    expect(onSave).not.toHaveBeenCalled();
    expect(details?.open).toBe(true);
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText("Weight (kg)")));
  });

  it("prefills saved details and allows clearing them back to unknown", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const initial: Draft = { ...draft(), bait: "Lugworm", technique: "Spinning", weightKg: 2.5, lengthCm: 60 };
    render(<CatchForm initial={initial} onSave={onSave} saveLabel="Save changes" />);
    expect(screen.getByLabelText("Weight (kg)")).toHaveValue("2.5");
    expect(screen.getByLabelText("Length (cm)")).toHaveValue("60");
    fireEvent.change(screen.getByLabelText("Weight (kg)"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Length (cm)"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const savedDraft = onSave.mock.calls[0]?.[0] as Draft;
    expect(savedDraft.weightKg).toBeUndefined();
    expect(savedDraft.lengthCm).toBeUndefined();
    expect(savedDraft.bait).toBe("Lugworm");
  });
});