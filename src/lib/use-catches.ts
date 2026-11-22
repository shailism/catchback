import { useEffect, useState } from "react";
import { CHANGED, getAllCatches, storageError, type Catch } from "./db";

export function useCatches() {
  const [catches, setCatches] = useState<Catch[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    let latest = 0;
    const load = async () => {
      const request = ++latest;
      try {
        const c = await getAllCatches();
        if (!active || request !== latest) return;
        setCatches(c.sort((a, b) => (b.date + (b.time ?? "")).localeCompare(a.date + (a.time ?? ""))));
        setError("");
      } catch (err) { if (active && request === latest) setError(storageError(err, "load")); }
    };
    load();
    window.addEventListener(CHANGED, load);
    window.addEventListener("pageshow", load);
    window.addEventListener("focus", load);
    return () => {
      active = false;
      window.removeEventListener(CHANGED, load);
      window.removeEventListener("pageshow", load);
      window.removeEventListener("focus", load);
    };
  }, []);
  return { catches, error };
}

export function usePhotoUrl(blob: Blob | undefined) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!blob) return;
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return url;
}

export function formatDate(iso: string) {
  const [y = 0, m = 1, d = 1] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}
