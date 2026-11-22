import { describe, expect, it } from "vitest";
import { isAppWorker, isNativeShell, refuseOfflineWorker } from "@/lib/offline-policy";

describe("offline registration safety", () => {
  it.each([
    "id-preview--one.lovable.app", "preview-v2--shop.gpt-eng.com",
    "project--one-dev.lovable.app", "lovableproject.com", "one.lovableproject-dev.com",
    "beta.lovable.dev", "one.beta.lovable.dev",
  ])("never registers inside preview host %s", host => {
    expect(refuseOfflineWorker(true, host, false, "")).toBe(true);
  });
  it("refuses development and iframes", () => {
    expect(refuseOfflineWorker(false, "localhost", false, "")).toBe(true);
    expect(refuseOfflineWorker(true, "catchback-tidebound-calendar.lovable.app", true, "")).toBe(true);
  });
  it("refuses the kill switch and exact delegated preview", () => {
    expect(refuseOfflineWorker(true, "fishing.example.com", false, "?sw=off")).toBe(true);
    expect(refuseOfflineWorker(true, "preview.example.com", false, "", "preview.example.com")).toBe(true);
  });
  it("allows published and custom domains", () => {
    expect(refuseOfflineWorker(true, "catchback-tidebound-calendar.lovable.app", false, "")).toBe(false);
    expect(refuseOfflineWorker(true, "preview-v2--shop.example.com", false, "")).toBe(false);
  });
  it("detects only a real native app shell", () => {
    expect(isNativeShell({ Capacitor: { isNativePlatform: () => true } })).toBe(true);
    expect(isNativeShell({ Capacitor: { isNativePlatform: () => false } })).toBe(false);
    expect(isNativeShell({})).toBe(false);
    expect(isNativeShell(undefined)).toBe(false);
  });
  it("only cleans up the exact same-origin app worker, not messaging workers", () => {
    const origin = "https://fishing.example.com";
    expect(isAppWorker(`${origin}/sw.js`, origin)).toBe(true);
    expect(isAppWorker(`${origin}/firebase-messaging-sw.js`, origin)).toBe(false);
    expect(isAppWorker(`${origin}/another/sw.js`, origin)).toBe(false);
    expect(isAppWorker("https://other.example.com/sw.js", origin)).toBe(false);
  });
});