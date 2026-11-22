import { createFileRoute, Link } from "@tanstack/react-router";
import { BarChart3, Plus, Scale, Ruler } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCatches } from "@/lib/use-catches";
import { aggregateInsights, aggregateTrips, type CountGroup } from "@/lib/insights";
import { useTrips } from "@/lib/use-trips";
import coast from "@/assets/coast.jpg";

export const Route = createFileRoute("/insights")({
  head: () => ({ meta: [
    { title: "Insights — CatchBack" },
    { name: "description", content: "Free, private summaries of your saved catches: species, bait, technique and recorded measurements." },
    { property: "og:title", content: "Insights — CatchBack" },
    { property: "og:description", content: "Explore counts and measurements from your saved catch journal, privately on your device." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Insights,
});

function Breakdown({ title, groups, total }: { title: string; groups: CountGroup[]; total: number }) {
  return <section className="border-b border-border py-6" aria-label={title}>
    <div className="flex items-baseline justify-between gap-3"><h2 className="section-title">{title}</h2><p className="shrink-0 text-xs text-muted-foreground">{total} saved records</p></div>
    <dl className="mt-3 divide-y divide-border">
      {groups.map(group => <div key={group.key} className="flex items-baseline justify-between gap-4 py-3">
        <dt className="min-w-0 break-words text-sm">{group.label}</dt><dd className="shrink-0 text-sm font-bold tabular-nums">{group.count} {group.count === 1 ? "record" : "records"}</dd>
      </div>)}
    </dl>
  </section>;
}

function Insights() {
  const { catches, error } = useCatches();
  const { trips, error: tripError } = useTrips();
  const summary = catches ? aggregateInsights(catches) : null;
  const tripSummary = trips ? aggregateTrips(trips) : null;
  return <div>
    <header className="insights-header">
      <img src={coast} alt="Turquoise water along a rocky coast" className="coast-image" width={1024} height={1536} />
      <div className="coast-shade" />
      <div className="relative z-10"><p className="eyebrow text-on-ocean-muted">Your catch journal</p><h1 className="mt-2 text-3xl font-extrabold">Insights</h1></div>
    </header>
    <div className="page">
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : summary === null ? <p role="status" className="text-sm text-muted-foreground">Loading your catches…</p> : summary.records === 0 ?
        <section className="py-6 text-center"><BarChart3 className="mx-auto size-10 text-accent" /><h2 className="mt-4 text-xl font-bold">No saved catches yet</h2><Button asChild className="mt-6 h-14 w-full"><Link to="/add"><Plus />Add catch</Link></Button></section> : <>
          <dl className="insights-overview" aria-label="Overview">
            <div><dd>{summary.records}</dd><dt>Saved catch records</dt></div>
            <div><dd>{summary.namedSpecies}</dd><dt>Distinct named species</dt></div>
            <div><dd>{summary.catchDates}</dd><dt>Dates with a recorded catch</dt></div>
          </dl>
          <p className="mt-5 text-sm leading-relaxed">Counts describe saved catches, not your chances of catching fish.</p>
          <p className="mt-2 text-xs text-muted-foreground">Includes any test entries you have saved.</p>
          <Breakdown title="Species" groups={summary.species} total={summary.records} />
          <Breakdown title="Bait / lure" groups={summary.bait} total={summary.records} />
          <Breakdown title="Technique" groups={summary.technique} total={summary.records} />
          <section className="py-6" aria-label="Recorded measurements"><h2 className="section-title">Largest recorded</h2>
            <dl className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2">
              {([{ title: "Weight", unit: "kg", result: summary.weight, Icon: Scale }, { title: "Length", unit: "cm", result: summary.length, Icon: Ruler }]).map(({ title, unit, result, Icon }) => <div key={title}>
                <dt className="flex items-center gap-2 text-sm text-muted-foreground"><Icon className="size-4" />{title}</dt>
                <dd className="mt-2 text-xl font-bold">{result.largest === null ? "No measurements" : `${result.largest.toLocaleString(undefined, { maximumFractionDigits: 20 })} ${unit}`}</dd>
                <dd className="mt-1 text-xs text-muted-foreground">{result.count} {result.count === 1 ? "record" : "records"} with a valid measurement</dd>
              </div>)}
            </dl>
          </section>
        </>}
      <section className="border-t border-border py-6" aria-label="Logged trips">
        <h2 className="section-title">Logged trips</h2>
        {tripError ? <p role="alert" className="mt-3 text-sm text-destructive">{tripError}</p> : tripSummary === null ? <p role="status" className="mt-3 text-sm">Loading your trips…</p> : <>
          <dl className="mt-4 space-y-3 text-sm">
            {[
              ["Actually logged trips", tripSummary.total],
              ["Trips with catches", tripSummary.withCatches],
              ["Trips without catches", tripSummary.withoutCatches],
              ["Trips with recorded duration", tripSummary.durationSamples],
            ].map(([label, count]) => <div key={label} className="flex justify-between gap-3"><dt>{label}</dt><dd className="font-bold tabular-nums">{count}</dd></div>)}
          </dl>
          <p className="mt-3 text-xs text-muted-foreground">Trip outcomes are entered by you, separate from catch photos. Includes saved test entries.</p>
          <Button asChild variant="secondary" className="mt-4 h-12 w-full"><Link to="/trips">Trips</Link></Button>
        </>}
      </section>
    </div>
  </div>;
}