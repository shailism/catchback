import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Plus, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTrips } from "@/lib/use-trips";
import { formatDate } from "@/lib/use-catches";

export const Route = createFileRoute("/trips/")({
  head: () => ({ meta: [
    { title: "Trips — CatchBack" }, { name: "description", content: "Your private manual trip log, including trips without catches." },
    { property: "og:title", content: "Trips — CatchBack" }, { property: "og:description", content: "Review your recorded fishing trips on this device." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }), component: Trips,
});
function Trips() {
  const { trips, error } = useTrips();
  return <div className="page">
    <Button asChild variant="ghost" className="mb-3"><Link to="/journal"><ArrowLeft />Journal</Link></Button>
    <h1 className="page-title">Trips</h1>
    <Button asChild className="my-4 h-14 w-full"><Link to="/trips/$id" params={{ id: "new" }}><Plus />Log a trip</Link></Button>
    {error ? <p role="alert" className="text-destructive">{error}</p> : trips === null ? <p role="status">Loading your trips…</p> : trips.length === 0 ? <p className="py-6 text-center text-muted-foreground">No logged trips yet.</p> : <ul className="divide-y divide-border">
      {trips.map(trip => <li key={trip.id}><Link to="/trips/$id" params={{ id: trip.id }} className="flex items-center justify-between gap-3 py-5">
        <div className="min-w-0"><p className="font-semibold">{formatDate(trip.date)}</p><p className="mt-1 text-sm text-primary">{trip.outcome === "caught" ? "Caught fish" : "No catches"}</p>{trip.spot && <p className="mt-1 break-words text-sm">{trip.spot}</p>}{trip.durationMinutes !== undefined && <p className="mt-1 text-xs text-muted-foreground">{trip.durationMinutes.toLocaleString()} minutes</p>}</div><ChevronRight className="size-5 shrink-0 text-muted-foreground" />
      </Link></li>)}
    </ul>}
  </div>;
}