export function refuseOfflineWorker(production: boolean, hostname: string, framed: boolean, search: string, delegatedHostname = "") {
  const host = hostname.toLowerCase();
  return !production || framed || new URLSearchParams(search).get("sw") === "off" ||
    (!!delegatedHostname && host === delegatedHostname.toLowerCase()) ||
    /^(?:id-preview|preview)(?:-[a-z0-9]+)?--.+\.(?:lovable\.app|gpt-eng\.com|gptengineer\.run)$/.test(host) ||
    /^project--.+-dev\.(?:lovable\.app|gpt-eng\.com|gptengineer\.run)$/.test(host) ||
    /(^|\.)(?:lovableproject\.com|lovableproject-dev\.com|beta\.lovable\.dev)$/.test(host);
}
// The native app bundles every file locally, so a web app-shell worker is never needed there.
export function isNativeShell(win: unknown) {
  const cap = (win as { Capacitor?: { isNativePlatform?: () => boolean } } | undefined)?.Capacitor;
  return typeof cap?.isNativePlatform === "function" && cap.isNativePlatform() === true;
}
export function isAppWorker(scriptURL: string, origin: string) {
  const url = new URL(scriptURL, origin);
  return url.origin === origin && url.pathname === "/sw.js";
}