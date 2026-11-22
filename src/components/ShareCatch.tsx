import { useEffect, useState } from "react";
import { Copy, Download, Facebook, Instagram, Share2 } from "lucide-react";
import { CatchShareMenu } from "@/components/CatchShareMenu";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Catch } from "@/lib/db";
import { isNativeApp, shareFilesNative } from "@/lib/native-files";
import { buildCaption, DEFAULT_SHARE, renderShareImage, shareViaDevice, type ShareOptions } from "@/lib/share";

const FIELDS: { key: keyof ShareOptions; label: string; has: (c: Catch) => boolean }[] = [
  { key: "photo", label: "Photo", has: () => true },
  { key: "species", label: "Species", has: c => !!c.species.trim() },
  { key: "weight", label: "Weight", has: c => c.weightKg !== undefined },
  { key: "length", label: "Length", has: c => c.lengthCm !== undefined },
  { key: "date", label: "Date", has: c => !!c.date },
  { key: "bait", label: "Bait or lure", has: c => !!c.bait?.trim() },
  { key: "technique", label: "Technique", has: c => !!c.technique?.trim() },
  { key: "place", label: "Spot name (off by default)", has: c => !!c.place.trim() },
];

function TikTokIcon() {
  return <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="size-6"><path d="M16.6 2c.4 2.4 1.7 3.8 4.4 4v4a9.3 9.3 0 0 1-4.4-1.4v7.2a6.4 6.4 0 1 1-5.5-6.3v4a2.5 2.5 0 1 0 1.5 2.3V2h4Z" /></svg>;
}

const PLATFORMS = [
  { name: "Facebook", Icon: Facebook },
  { name: "Instagram", Icon: Instagram },
  { name: "TikTok", Icon: TikTokIcon },
];

export function ShareCatch({ c, menuOnly = false }: { c: Catch; menuOnly?: boolean }) {
  const [open, setOpen] = useState(false);
  const [o, setO] = useState<ShareOptions>(DEFAULT_SHARE);
  const [image, setImage] = useState<Blob | null>(null);
  const [url, setUrl] = useState<string>();
  const [status, setStatus] = useState("");
  const [target, setTarget] = useState("");
  const caption = buildCaption(c, o);

  useEffect(() => {
    if (!open) return;
    setO(DEFAULT_SHARE); setStatus(""); setTarget("");
    let u: string | undefined; let active = true;
    renderShareImage(c.photo).then(b => { if (!active) return; setImage(b); u = URL.createObjectURL(b); setUrl(u); })
      .catch(() => active && setStatus("Couldn't prepare the photo. You can still copy the caption."));
    return () => { active = false; if (u) URL.revokeObjectURL(u); setUrl(undefined); setImage(null); };
  }, [open, c.photo]);

  const img = o.photo ? image : null;
  const share = async (platform = "") => {
    setTarget(platform);
    setStatus(platform ? `Choose ${platform} in your device's share menu if it appears.` : "");
    try {
      const r = await shareViaDevice(caption, img);
      setStatus(r === "shared" ? "Handed to the app you picked. CatchBack didn't post anything itself."
        : r === "cancelled" ? "Sharing cancelled. Nothing was shared."
        : `This browser can't share ${o.photo ? "the photo" : "directly"}. ${platform ? `Open ${platform} yourself after using` : "Use"} Download image and Copy caption below.`);
    } catch { setStatus("Sharing failed. Nothing was shared. Try Download image and Copy caption."); }
  };
  const download = async () => {
    if (!image) return;
    if (isNativeApp()) {
      // App web views ignore download links; hand the cleaned image to the phone's save/share menu.
      try {
        const r = await shareFilesNative([{ name: `catch-${c.date || "photo"}.jpg`, blob: image }]);
        setStatus(r === "shared" ? "Image handed to the option you picked, without hidden location data." : "Saving cancelled. Nothing was saved.");
      } catch { setStatus("Couldn't save the image. Nothing was saved."); }
      return;
    }
    const u = URL.createObjectURL(image);
    const a = document.createElement("a"); a.href = u; a.download = `catch-${c.date || "photo"}.jpg`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 30_000);
    setStatus("Image downloaded without hidden location data.");
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(caption); setStatus("Caption copied."); }
    catch { setStatus("Couldn't copy automatically — select the caption text and copy it."); }
  };

  return (
    <>
      <div className="absolute right-2 top-2 z-10"><CatchShareMenu onShare={() => setOpen(true)} /></div>
      {!menuOnly && <Button className="mt-4 h-12 w-full" onClick={() => setOpen(true)}><Share2 /> Share catch</Button>}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Share catch</DialogTitle>
            <DialogDescription>Nothing is posted automatically. Coordinates, notes and spot name are left out unless you choose the spot. Hidden photo location data is always removed.</DialogDescription>
          </DialogHeader>
          {o.photo && (url ? <img src={url} alt="Share preview" className="w-full rounded-lg" /> : <p className="text-sm text-muted-foreground">Preparing photo…</p>)}
          <pre aria-label="Caption preview" className="whitespace-pre-wrap rounded-lg bg-muted p-3 text-sm font-sans select-all">{caption}</pre>
          <fieldset className="grid grid-cols-2 gap-3">
            <legend className="mb-2 text-sm font-medium">Include</legend>
            {FIELDS.filter(f => f.has(c)).map(f => (
              <label key={f.key} className="flex items-center gap-2 text-sm">
                <Checkbox className="size-5" checked={o[f.key]} onCheckedChange={v => setO({ ...o, [f.key]: v === true })} />{f.label}
              </label>
            ))}
          </fieldset>
          <div className="grid grid-cols-3 gap-2" aria-label="Social sharing choices">
            {PLATFORMS.map(({ name, Icon }) => <Button key={name} variant="outline" className="h-20 min-w-0 flex-col gap-2 rounded-lg px-1 text-xs [&_svg]:size-6" disabled={o.photo && !image} onClick={() => share(name)}><Icon />{name}</Button>)}
          </div>
          <p className="text-sm text-muted-foreground">{target ? `Choose ${target} in the device share menu if listed. If it is missing, download the photo, copy the caption and open ${target} yourself.` : "These choices open your device's share menu. Pick the app there, if listed."} Browsers cannot select a particular app or post automatically.</p>
          <Button className="h-12" disabled={o.photo && !image} onClick={() => share()}><Share2 /> Share…</Button>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" className="h-12 min-w-0 gap-1 px-2 text-xs sm:text-sm" onClick={download} disabled={!o.photo || !image}><Download /> Download image</Button>
            <Button variant="outline" className="h-12 min-w-0 gap-1 px-2 text-xs sm:text-sm" onClick={copy}><Copy /> Copy caption</Button>
          </div>
          <p className="text-xs text-muted-foreground">Which apps appear depends on your phone. Some apps (e.g. Instagram) accept the image but drop the caption — paste the copied caption there.</p>
          {status && <p role="status" className="text-sm font-medium">{status}</p>}
        </DialogContent>
      </Dialog>
    </>
  );
}
