import { isAppWorker, isNativeShell, refuseOfflineWorker } from "./offline-policy";

export type OfflineStatus = "checking" | "bundled" | "preview" | "unsupported" | "preparing" | "ready" | "failed";
let status: OfflineStatus = "checking";
let started: Promise<void> | undefined;
const listeners = new Set<() => void>();
export const offlineSnapshot = () => status;
export const subscribeOffline = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
function setStatus(value: OfflineStatus) { status = value; listeners.forEach(listener => listener()); }

async function prepare() {
  // The app-store build ships every file inside the app; no worker is needed or registered.
  if (import.meta.env["VITE_NATIVE_BUILD"] === "1" || isNativeShell(window)) { setStatus("bundled"); return; }
  if (!("serviceWorker" in navigator)) { setStatus("unsupported"); return; }
  if (isNativeShell(window) || refuseOfflineWorker(import.meta.env.PROD, location.hostname, window.self !== window.top, location.search)) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.filter(registration => [registration.active, registration.waiting, registration.installing].some(worker => worker && isAppWorker(worker.scriptURL, location.origin))).map(registration => registration.unregister()));
    setStatus("preview"); return;
  }
  setStatus("preparing");
  // Install atomically precaches the fallback and every built route chunk.
  // Updates wait for old tabs to close; no reload or skipWaiting listeners.
  const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
  if (!registration.active) {
    await new Promise<void>((resolve, reject) => {
      const worker = registration.installing ?? registration.waiting;
      if (!worker) { reject(new Error("Offline preparation has not started")); return; }
      const timer = window.setTimeout(() => { cleanup(); reject(new Error("Offline preparation timed out")); }, 60000);
      const cleanup = () => { clearTimeout(timer); worker.removeEventListener("statechange", check); };
      const check = () => {
        if (worker.state === "activated") { cleanup(); resolve(); }
        else if (worker.state === "redundant") { cleanup(); reject(new Error("Offline preparation failed")); }
      };
      worker.addEventListener("statechange", check); check();
    });
  }
  // Cache eviction can leave a registration alive without its offline shell.
  const keys = await caches.keys();
  let shellPresent = false;
  for (const key of keys.filter(key => key.startsWith("catchback-offline-precache-"))) {
    const cache = await caches.open(key);
    const requests = await cache.keys();
    if (requests.some(request => new URL(request.url).pathname === "/offline.html")) { shellPresent = true; break; }
  }
  if (!shellPresent) throw new Error("Offline shell is not available on this browser");
  setStatus("ready");
  if (navigator.onLine) void registration.update().catch(() => { /* Existing offline release stays available. */ });
}
export function prepareOffline() { started ??= prepare().catch(() => { setStatus("failed"); }); return started; }
export function retryOffline() { started = undefined; return prepareOffline(); }