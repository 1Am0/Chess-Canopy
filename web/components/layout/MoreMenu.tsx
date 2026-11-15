"use client";

import Link from "next/link";
import { BookMarked, Keyboard, MoreHorizontal, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useExplorerStore } from "@/lib/store";
import { playSound, unlockSound } from "@/lib/sound";

/**
 * Phone-only "more" menu: holds the sound toggle and the shortcuts help so the header stays uncluttered, and on the
 * explorer the link to the Repertoire page (`repertoireHref`). `shortcuts` false hides the shortcuts help (pages
 * without keyboard shortcuts).
 */
export function MoreMenu({ repertoireHref, shortcuts = true }: { repertoireHref?: string; shortcuts?: boolean } = {}) {
  const on = useExplorerStore((s) => s.soundEnabled);
  const setOn = useExplorerStore((s) => s.setSoundEnabled);
  const setUi = useExplorerStore((s) => s.setUi);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="chit" size="icon" aria-label="More options" className="size-11 sm:hidden">
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        {repertoireHref && (
          <DropdownMenuItem asChild>
            <Link href={repertoireHref}>
              <BookMarked className="size-4" />
              Repertoire
            </Link>
          </DropdownMenuItem>
        )}
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
        {shortcuts && (
          <DropdownMenuItem onSelect={() => setUi({ shortcutsOpen: true })}>
            <Keyboard className="size-4" />
            Keyboard shortcuts
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
