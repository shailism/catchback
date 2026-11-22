import { describe, expect, it, vi } from "vitest";
import { buildCaption, DEFAULT_SHARE, shareViaDevice } from "@/lib/share";
import type { Catch } from "@/lib/db";

const c: Catch = { id: "1", photo: new Blob(), date: "2026-05-03", time: null, lat: 34.7, lng: 33.0,
  place: "Secret rock", species: "Sea Bass", notes: "private note", bait: "shrimp", technique: "float",
  weightKg: 1.2, lengthCm: 40, dateSource: "manual", locationSource: "manual", createdAt: 0 };

describe("share caption", () => {
  it("excludes spot, coordinates and notes by default", () => {
    const t = buildCaption(c, DEFAULT_SHARE);
    expect(t).toContain("Sea Bass");
    expect(t).not.toContain("Secret rock");
    expect(t).not.toContain("34.7");
    expect(t).not.toContain("private note");
  });
  it("includes spot only when selected", () => {
    const text = buildCaption(c, { ...DEFAULT_SHARE, place: true });
    expect(DEFAULT_SHARE.place).toBe(false);
    expect(text).toContain("Secret rock");
    expect(text).not.toContain("34.7");
    expect(text).not.toContain("private note");
  });
  it("omits deselected weight", () => {
    expect(buildCaption(c, { ...DEFAULT_SHARE, weight: false })).not.toContain("1.2 kg");
  });
});

describe("device share", () => {
  it("reports cancellation as cancelled", async () => {
    Object.assign(navigator, { share: vi.fn().mockRejectedValue(Object.assign(new Error(), { name: "AbortError" })) });
    expect(await shareViaDevice("x", null)).toBe("cancelled");
  });
  it("reports unsupported without share API", async () => {
    Object.assign(navigator, { share: undefined });
    expect(await shareViaDevice("x", null)).toBe("unsupported");
  });
  it("does not invoke the picker when photo sharing is unsupported", async () => {
    const share = vi.fn();
    Object.assign(navigator, { share, canShare: vi.fn().mockReturnValue(false) });
    expect(await shareViaDevice("caption", new Blob())).toBe("unsupported");
    expect(share).not.toHaveBeenCalled();
  });
  it("shares only the caption and sanitized file, never a local URL", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { share, canShare: vi.fn().mockReturnValue(true) });
    expect(await shareViaDevice("caption", new Blob(["sanitized"], { type: "image/jpeg" }))).toBe("shared");
    const data = share.mock.calls[0]?.[0];
    expect(Object.keys(data).sort()).toEqual(["files", "text"]);
    expect(data.text).toBe("caption");
    expect(data.files[0].type).toBe("image/jpeg");
    expect(data.files[0].name).toBe("catch.jpg");
  });
  it("does not misreport a failed picker as cancellation or success", async () => {
    Object.assign(navigator, { share: vi.fn().mockRejectedValue(new Error("Picker failed")) });
    await expect(shareViaDevice("caption", null)).rejects.toThrow("Picker failed");
  });
});
