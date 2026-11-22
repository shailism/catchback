import { createFileRoute, Link } from "@tanstack/react-router";
import { Fish, LockKeyhole, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/community")({
  head: () => ({ meta: [
    { title: "Community — CatchBack" },
    { name: "description", content: "CatchBack community is planned. Your catch photos and precise fishing locations remain private." },
    { property: "og:title", content: "Community — CatchBack" },
    { property: "og:description", content: "Intentional sharing is planned; your catches stay private." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Community,
});
function Community() {
  return <div className="page"><p className="eyebrow">On the horizon</p><h1 className="page-title">Community</h1><div className="community-empty"><Fish className="size-16 text-accent" strokeWidth={1} /><h2 className="mt-5 text-2xl font-bold">Good catches. Shared by choice.</h2><p className="mt-3 text-sm leading-relaxed text-muted-foreground">A photo-led community is planned, not connected yet. No posts or catches are shared in this version.</p><p className="mt-6 flex items-start gap-3 text-left text-sm"><LockKeyhole className="size-5 shrink-0 text-primary" />Your photos and precise spots stay private on this device.</p><p className="mt-4 flex items-start gap-3 text-left text-sm"><Camera className="size-5 shrink-0 text-primary" />Future sharing will let you choose photos and locations independently, with hidden photo GPS removed.</p><Button asChild className="mt-8 h-12 w-full"><Link to="/journal">Back to your journal</Link></Button></div></div>;
}