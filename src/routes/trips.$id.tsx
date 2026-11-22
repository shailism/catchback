import { createFileRoute, Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { TripForm } from "@/components/TripForm";
import { deleteTrip, getTrip, saveTrip, tripStorageError, type Trip } from "@/lib/db";

declare module "@tanstack/react-router" {
  interface HistoryState { tripSaved?: boolean }
}

export const Route = createFileRoute("/trips/$id")({
  head: () => ({ meta: [
    { title: "Trip details — CatchBack" }, { name: "description", content: "Record or edit a private fishing trip with an explicitly chosen outcome." },
    { property: "og:title", content: "Trip details — CatchBack" }, { property: "og:description", content: "Save a trip date, outcome and optional details on your device." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }), component: TripDetail,
});
export function TripDetail() {
  const { id } = Route.useParams();
  return <TripDraftDetail key={id} id={id} />;
}
function TripDraftDetail({ id }: { id: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  // Carried through navigation so the confirmation survives the new-trip remount.
  const justSaved = id !== "new" ? (location.state as { tripSaved?: boolean } | undefined)?.tripSaved : undefined;
  const initialFeedback = justSaved === undefined ? "" : justSaved ? "Trip saved on this device." : "Trip saved. Storage protection wasn't granted — export a backup before closing.";
  // Retain identity even if the write commits but readback/navigation fails.
  // The keyed route instance resets it only when a different draft is opened.
  const newIdentity = useRef<{ id: string; createdAt: number } | null>(null);
  const [trip, setTrip] = useState<Trip | null>();
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  useEffect(() => {
    let active = true; setTrip(undefined); setError("");
    if (id === "new") setTrip(null);
    else getTrip(id).then(row => { if (active) setTrip(row ?? null); }).catch(err => { if (active) setError(tripStorageError(err, "load")); });
    return () => { active = false; };
  }, [id]);
  return <div className="page">
    <Button asChild variant="ghost" className="mb-3"><Link to="/trips"><ArrowLeft />Trips</Link></Button>
    <h1 className="page-title">{id === "new" ? "Log a trip" : "Trip details"}</h1>
    {error && <p role="alert" className="my-3 text-destructive">{error}</p>}
    {!error && trip === undefined ? <p role="status">Loading your trip…</p> : !error && trip === null && id !== "new" ? <p>This trip isn't on this device.</p> : !error && trip !== undefined && <>
      <TripForm key={id} initial={trip ?? { date: "", outcome: "" }} initialFeedback={initialFeedback} onSave={async draft => {
        if (!trip && !newIdentity.current) newIdentity.current = { id: crypto.randomUUID(), createdAt: Date.now() };
        const identity = trip ?? newIdentity.current;
        if (!identity) throw new Error("Couldn't prepare this trip. Please retry.");
        const saved: Trip = { ...draft, id: identity.id, createdAt: identity.createdAt };
        const protectedStorage = await saveTrip(saved);
        if (id === "new") {
          await navigate({ to: "/trips/$id", params: { id: saved.id }, replace: true, state: { tripSaved: protectedStorage } });
          if (protectedStorage) toast.success("Trip saved on this device.");
          else toast.warning("Trip saved. Storage protection wasn't granted — export a backup before closing.", { duration: 12000 });
        }
        return protectedStorage;
      }} />
      {deleteError && <p role="alert" className="mt-3 text-sm text-destructive">{deleteError}</p>}
      {trip && <Button variant="ghost" disabled={deleting} className="mt-4 h-12 w-full text-destructive" onClick={async () => {
        if (!window.confirm("Delete this trip from this device? Catch photos will not be changed.")) return;
        setDeleting(true); setDeleteError("");
        try { await deleteTrip(trip.id); await navigate({ to: "/trips" }); }
        catch (err) { setDeleteError(tripStorageError(err, "delete")); }
        finally { setDeleting(false); }
      }}><Trash2 />Delete trip</Button>}
    </>}
  </div>;
}