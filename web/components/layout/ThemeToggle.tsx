"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Keyboard, Laptop, Moon, Palette, Sun } from "lucide-react";
import { Stamp } from "@/components/field";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useExplorerStore, type BoardTheme } from "@/lib/store";
import { BOARD_THEMES } from "@/lib/board-themes";
import { SOUND_THEMES, playSound, unlockSound, type SoundTheme } from "@/lib/sound";

const BOARDS: { id: BoardTheme; label: string }[] = [
  { id: "lichen", label: "Lichen" },
  { id: "green", label: "Green" },
  { id: "brown", label: "Brown" },
  { id: "blue", label: "Blue" },
  { id: "slate", label: "Slate" },
];

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const boardTheme = useExplorerStore((s) => s.boardTheme);
  const setBoardTheme = useExplorerStore((s) => s.setBoardTheme);
  const soundTheme = useExplorerStore((s) => s.soundTheme);
  const setSoundTheme = useExplorerStore((s) => s.setSoundTheme);
  const setUi = useExplorerStore((s) => s.setUi);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Appearance">
          {mounted && resolvedTheme === "dark" ? <Moon /> : mounted ? <Sun /> : <Palette />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 p-0 pb-1">
        <DropdownMenuLabel className="px-3 pt-3">Theme</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={mounted ? theme : undefined} onValueChange={setTheme} aria-label="Theme">
          {([["light", Sun, "Light"], ["dark", Moon, "Dark"], ["system", Laptop, "System"]] as const).map(([v, Icon, label]) => (
            <DropdownMenuRadioItem key={v} value={v}>
              <Icon /> {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator className="mx-0" />
        <DropdownMenuLabel className="px-3 pt-2">Board</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={boardTheme} onValueChange={(v) => setBoardTheme(v as BoardTheme)} aria-label="Board">
          {BOARDS.map((b) => (
            <DropdownMenuRadioItem key={b.id} value={b.id}>
              <span aria-hidden className="grid size-5 shrink-0 grid-cols-2 overflow-hidden rounded-[2px] border border-rule-strong">
                <span style={{ background: BOARD_THEMES[b.id].light }} />
                <span style={{ background: BOARD_THEMES[b.id].dark }} />
                <span style={{ background: BOARD_THEMES[b.id].dark }} />
                <span style={{ background: BOARD_THEMES[b.id].light }} />
              </span>
              <span className="font-serif text-base italic">{b.label}</span>
              {b.id === "lichen" && <Stamp aria-hidden className="ml-auto mr-1 text-[9px]">default</Stamp>}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator className="mx-0" />
        <DropdownMenuLabel className="px-3 pt-2">Move sounds</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={soundTheme}
          aria-label="Move sounds"
          onValueChange={(v) => {
            unlockSound();
            setSoundTheme(v as SoundTheme);
            // Preview the new theme with a capture once its samples have loaded.
            setTimeout(() => playSound("capture"), 150);
          }}
        >
          {SOUND_THEMES.map((t) => (
            <DropdownMenuRadioItem key={t.id} value={t.id}>
              {t.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator className="mx-0 sm:hidden" />
        <DropdownMenuItem className="sm:hidden" onSelect={() => setUi({ shortcutsOpen: true })}>
          <Keyboard /> Keyboard shortcuts
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
