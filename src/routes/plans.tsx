import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2, Clock3, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FREE_WORKING, FREE_GOALS, PLUS_PLANNED, PLUS_STATUS_NOTE, type FeatureItem } from "@/lib/features";

export const Route = createFileRoute("/plans")({
  head: () => ({
    meta: [
      { title: "Free & Plus — CatchBack" },
      { name: "description", content: "What CatchBack does for free today, what's planned for Free, and what Plus might add later." },
      { property: "og:title", content: "Free & Plus — CatchBack" },
      { property: "og:description", content: "What CatchBack does for free today and what's planned next." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Plans,
});

function FeatureRow({ item, icon }: { item: FeatureItem; icon: "check" | "clock" }) {
  const Icon = icon === "check" ? CheckCircle2 : Clock3;
  return (
    <li className="flex gap-2 text-sm">
      <Icon className={`size-5 shrink-0 ${icon === "check" ? "text-primary" : "text-muted-foreground"}`} />
      <span className="min-w-0">
        <span className="font-medium">{item.label}</span>
        {item.note && <span className="block text-muted-foreground">{item.note}</span>}
      </span>
    </li>
  );
}

function Plans() {
  return (
    <div className="page space-y-5">
      <Button asChild variant="ghost" className="-ml-2 h-11 gap-1">
        <Link to="/more"><ArrowLeft /> Settings & privacy</Link>
      </Button>
      <h1 className="page-title">Free & Plus</h1>
      <p className="text-sm text-muted-foreground">
        Everything that works today is free and stays free. Plus is only an idea for later — there is nothing to buy.
      </p>

      <section className="card-panel space-y-3">
        <h2 className="font-semibold">Free — working now</h2>
        <ul className="space-y-3">
          {FREE_WORKING.map((f) => <FeatureRow key={f.label} item={f} icon="check" />)}
        </ul>
        <p className="text-sm text-muted-foreground">
          Your catches, photos and spots stay on this device. Reminders currently appear inside the app only.
        </p>
      </section>

      <section className="card-panel space-y-3">
        <h2 className="font-semibold">Free — future goals, not built yet</h2>
        <ul className="space-y-3">
          {FREE_GOALS.map((f) => <FeatureRow key={f.label} item={f} icon="clock" />)}
        </ul>
      </section>

      <section className="card-panel space-y-3 bg-muted">
        <h2 className="flex items-center gap-2 font-semibold"><Sparkles className="size-5 text-primary" /> Plus — planned, not available</h2>
        <ul className="space-y-3">
          {PLUS_PLANNED.map((f) => <FeatureRow key={f.label} item={f} icon="clock" />)}
        </ul>
        <p className="rounded-xl bg-warning p-3 text-sm text-warning-foreground">{PLUS_STATUS_NOTE}</p>
      </section>
    </div>
  );
}
