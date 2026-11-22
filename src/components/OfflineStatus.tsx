import { useSyncExternalStore } from "react";
import { WifiOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { offlineSnapshot, subscribeOffline, retryOffline } from "@/lib/offline";

export function OfflineStatus() {
  const state = useSyncExternalStore(subscribeOffline, offlineSnapshot, () => "checking");
  const text = {
    checking: "Checking offline availability…",
    bundled: "This app version includes all its own files, so it opens without a signal. No offline preparation is needed.",
    preview: "Offline preparation is disabled in this preview. It becomes available in the published app.",
    unsupported: "This browser cannot prepare offline access. Your records are still local; reopening without a signal is not ready.",
    preparing: "Preparing offline access — keep this page open with a signal until it is ready.",
    ready: "Ready to reopen offline on this browser and website address. Updates take effect after you close all CatchBack tabs and reopen.",
    failed: "Offline access is not ready. Reconnect and retry before leaving signal coverage.",
  }[state];
  return <section className="space-y-3" aria-labelledby="offline-heading"><h2 id="offline-heading" className="flex items-center gap-2 font-semibold"><WifiOff className="size-5 text-primary" />Offline access</h2><p role="status" className="text-sm">{text}</p><p className="text-xs text-muted-foreground">{state === "bundled" ? "" : "The first visit needs a signal. "}Photos and trips stay on this device. Clearing browser data can remove records and offline access; keep a backup. Weather remains a demonstration, and reminders appear inside the app only.</p>{state === "failed" && <Button variant="outline" onClick={() => void retryOffline()}><RefreshCw />Retry offline preparation</Button>}</section>;
}