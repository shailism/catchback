import { useEffect, useState } from "react";
import { CHANGED, getAllTrips, tripStorageError, type Trip } from "./db";

export function useTrips() {
  const [trips, setTrips] = useState<Trip[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    let latest = 0;
    const load = async () => {
      const request = ++latest;
      try {
        const rows = await getAllTrips();
        if (!active || request !== latest) return;
        setTrips(rows.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt));
        setError("");
      } catch (err) { if (active && request === latest) setError(tripStorageError(err, "load")); }
    };
    load();
    window.addEventListener(CHANGED, load);
    window.addEventListener("pageshow", load);
    window.addEventListener("focus", load);
    return () => { active = false; window.removeEventListener(CHANGED, load); window.removeEventListener("pageshow", load); window.removeEventListener("focus", load); };
  }, []);
  return { trips, error };
}