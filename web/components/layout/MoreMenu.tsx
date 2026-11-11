"use client";

import { Keyboard, MoreHorizontal, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useExplorerStore } from "@/lib/store";
import { playSound, unlockSound } from "@/lib/sound";

/** Phone-only "more" menu: holds the sound toggle and the shortcuts help so the header stays uncluttered. */
export function MoreMenu() {
  const on = useExplorerStore((s) => s.soundEnabled);
  const setOn = useExplorerStore((s) => s.setSoundEnabled);
  const setUi = useExplorerStore((s) => s.setUi);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" aria-label="More options" className="sm:hidden">
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        <DropdownMenuCheckboxItem
          checked={!on}
          onCheckedChange={(muted) => {
            unlockSound();
            setOn(!muted);
            if (!muted) playSound("move");
          }}
        >
          {on ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
          Mute move sounds
        </DropdownMenuCheckboxItem>
        <DropdownMenuItem onSelect={() => setUi({ shortcutsOpen: true })}>
          <Keyboard className="size-4" />
          Keyboard shortcuts
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
