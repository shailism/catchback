import { beforeEach, describe, expect, it, vi } from "vitest";

const fs = vi.hoisted(() => ({ writeFile: vi.fn(), rmdir: vi.fn(), deleteFile: vi.fn() }));
const share = vi.hoisted(() => ({ share: vi.fn() }));
const native = vi.hoisted(() => ({ on: true }));
vi.mock("@capacitor/core", () => ({ Capacitor: { isNativePlatform: () => native.on } }));
vi.mock("@capacitor/filesystem", () => ({ Filesystem: fs, Directory: { Cache: "CACHE", Data: "DATA", Documents: "DOCUMENTS" } }));
vi.mock("@capacitor/share", () => ({ Share: share }));

import { SHARE_DIR, isShareCancel, safeShareName, shareFilesNative } from "@/lib/native-files";
import { shareViaDevice } from "@/lib/share";

beforeEach(() => {
  vi.clearAllMocks(); native.on = true;
  fs.writeFile.mockImplementation(async ({ path }: { path: string }) => ({ uri: `file:///cache/${path}` }));
  fs.rmdir.mockResolvedValue(undefined);
});

describe("native file hand-off", () => {
  it("writes the exact backup bytes to the cache share folder and opens the sheet with that file", async () => {
    share.share.mockResolvedValue({});
    const json = '{"version":3,"catches":[],"trips":[]}';
    expect(await shareFilesNative([{ name: "catchback-backup.json", blob: new Blob([json]) }], undefined, "Save CatchBack backup")).toBe("shared");
    const call = fs.writeFile.mock.calls[0]![0];
    expect(call.directory).toBe("CACHE");
    expect(call.path.startsWith(`${SHARE_DIR}/`)).toBe(true);
    expect(atob(call.data)).toBe(json);
    expect(share.share.mock.calls[0]![0].files).toEqual([`file:///cache/${call.path}`]);
  });
  it("reports a dismissed sheet as cancelled, never shared", async () => {
    share.share.mockRejectedValue(new Error("Share canceled"));
    expect(await shareFilesNative([{ name: "a.jpg", blob: new Blob(["x"]) }])).toBe("cancelled");
  });
  it("surfaces real failures instead of claiming success", async () => {
    share.share.mockRejectedValue(new Error("No activity found"));
    await expect(shareFilesNative([])).rejects.toThrow("No activity found");
  });
  it("cleans only its own cache folder, never app data or documents", async () => {
    share.share.mockResolvedValue({});
    await shareFilesNative([{ name: "a.jpg", blob: new Blob(["x"]) }]);
    for (const [arg] of [...fs.rmdir.mock.calls, ...fs.deleteFile.mock.calls]) {
      expect(arg.directory).toBe("CACHE");
      expect(arg.path.startsWith(SHARE_DIR)).toBe(true);
    }
    expect(fs.rmdir).toHaveBeenCalledTimes(1);
  });
  it("keeps file names inside the share folder", () => {
    expect(safeShareName("../../evil.json")).toBe("evil.json");
    expect(isShareCancel(new Error("User cancelled"))).toBe(true);
    expect(isShareCancel(new Error("Permission denied"))).toBe(false);
  });
  it("uses the native sheet in the app and the browser share on the website", async () => {
    share.share.mockResolvedValue({});
    expect(await shareViaDevice("cap", new Blob(["img"]))).toBe("shared");
    expect(share.share).toHaveBeenCalledTimes(1);
    native.on = false; share.share.mockClear();
    Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
    expect(await shareViaDevice("cap", null)).toBe("unsupported");
    expect(share.share).not.toHaveBeenCalled();
  });
});
