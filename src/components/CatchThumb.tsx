import { Link } from "@tanstack/react-router";
import type { Catch } from "@/lib/db";
import { formatDate, usePhotoUrl } from "@/lib/use-catches";
import { ShareCatch } from "@/components/ShareCatch";

export function CatchRow({ c, extra }: { c: Catch; extra?: string }) {
  const url = usePhotoUrl(c.photo);
  return (
    <Link to="/catch/$id" params={{ id: c.id }} className="flex items-center gap-3 border-b border-border py-3">
      {url ? <img src={url} alt="" className="size-16 rounded-xl object-cover" /> : <div className="size-16 rounded-xl bg-muted" />}
      <div className="min-w-0">
        <p className="truncate font-semibold">{c.species || "Catch"}</p>
        <p className="text-sm text-muted-foreground">{formatDate(c.date)}{c.time ? ` · ${c.time}` : ""}</p>
        {(extra || c.place) && <p className="truncate text-sm text-primary">{extra || c.place}</p>}
      </div>
    </Link>
  );
}

export function CatchTile({ c }: { c: Catch }) {
  const url = usePhotoUrl(c.photo);
  return (
    <div className="relative overflow-hidden rounded-lg bg-muted">
    <Link to="/catch/$id" params={{ id: c.id }} className="relative block">
      {url && <img src={url} alt={c.species || "Catch"} className="aspect-square w-full object-cover" />}
      <div className="tile-caption">
        <p className="truncate text-sm font-semibold">{c.species || "Catch"}</p>
        <p className="text-xs opacity-90">{formatDate(c.date)}</p>
      </div>
    </Link>
    <ShareCatch c={c} menuOnly />
    </div>
  );
}
