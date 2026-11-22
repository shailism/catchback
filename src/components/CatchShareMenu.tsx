import { MoreHorizontal, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export function CatchShareMenu({ onShare }: { onShare: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="icon" className="size-11 rounded-full shadow-soft" aria-label="More options" title="More options">
          <MoreHorizontal className="size-6" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem className="min-h-11" onSelect={onShare}><Share2 /> Share catch</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}