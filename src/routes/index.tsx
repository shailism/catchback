import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, ArrowRight, Fish, LockKeyhole, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DemoConditions } from "@/components/DemoConditions";
import { CatchTile } from "@/components/CatchThumb";
import { useCatches } from "@/lib/use-catches";
import coast from "@/assets/coast.jpg";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "CatchBack — days on the water" },
    { name: "description", content: "Your private fishing journal, seasonal reminders and clearly labelled demonstration fishing conditions." },
    { property: "og:title", content: "CatchBack — days on the water" },
    { property: "og:description", content: "Keep your catch memories private and explore the next chapter of CatchBack." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Home,
});
function Home() {
  const { catches, error } = useCatches();
  return <div>
    <header className="coastal-header">
      <img src={coast} alt="Turquoise water along a rocky Mediterranean coast" width={1024} height={1536} className="coast-image" />
      <div className="coast-shade" />
      <div className="relative z-10">
        <div className="flex items-center justify-between"><Link to="/" className="brand"><Fish className="size-7" />CatchBack<span className="brand-dot">.</span></Link><Button asChild variant="ghost" size="icon" className="hero-icon"><Link to="/reminders" aria-label="Seasonal reminders"><Bell /></Link></Button></div>
        <div className="hero-copy"><p className="eyebrow text-on-ocean-muted">Your private fishing journal</p><h1>Closer to the water!</h1><p className="mt-2 text-sm text-on-ocean-muted">Save the catch. Remember the moment.</p></div>
        <Button asChild className="hero-add"><Link to="/add"><Plus />Add Catch</Link></Button>
      </div>
    </header>
    <DemoConditions />
    <section className="recent-section">
      {error && <p role="alert" className="text-destructive">{error}</p>}
      <div className="flex items-center justify-between"><h2 className="section-title">Recent catches</h2><Button asChild variant="link" className="px-0"><Link to="/journal">Your journal <ArrowRight /></Link></Button></div>
      {catches === null ? <p className="mt-5 text-sm text-muted-foreground">Loading your catches…</p> : catches.length ? <div className="mt-4 grid grid-cols-2 gap-3">{catches.slice(0, 4).map(c => <CatchTile key={c.id} c={c} />)}</div> : <div className="journal-empty"><Fish className="size-9 text-accent" strokeWidth={1.4}/><div><h3 className="font-bold">Your next catch belongs here.</h3><p className="mt-1 text-sm text-muted-foreground">A photo, a place, a moment to return to.</p></div></div>}
      <p className="mt-5 flex items-center justify-center gap-2 text-xs text-muted-foreground"><LockKeyhole className="size-3" />Private by default. Saved on this device.</p>
    </section>
  </div>;
}
