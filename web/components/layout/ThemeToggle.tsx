"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Check, Laptop, Moon, Palette, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useExplorerStore, type BoardTheme } from "@/lib/store";

const BOARDS: { id: BoardTheme; label: string; colors: [string, string] }[] = [
  { id: "green", label: "Green", colors: ["#eeeed2", "#769656"] },
  { id: "brown", label: "Brown", colors: ["#f0d9b5", "#b58863"] },
  { id: "blue", label: "Blue", colors: ["#dee3e6", "#8ca2ad"] },
  { id: "slate", label: "Slate", colors: ["#c8ccd4", "#5d6b82"] },
];

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const boardTheme = useExplorerStore((s) => s.boardTheme);
  const setBoardTheme = useExplorerStore((s) => s.setBoardTheme);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Appearance">
          {mounted && resolvedTheme === "dark" ? <Moon /> : mounted ? <Sun /> : <Palette />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        {([["light", Sun, "Light"], ["dark", Moon, "Dark"], ["system", Laptop, "System"]] as const).map(([v, Icon, label]) => (
          <DropdownMenuItem key={v} onSelect={() => setTheme(v)}>
            <Icon /> {label}
            {mounted && theme === v && <Check className="ml-auto" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Board</DropdownMenuLabel>
        {BOARDS.map((b) => (
          <DropdownMenuItem key={b.id} onSelect={() => setBoardTheme(b.id)}>
            <span className="flex size-4 overflow-hidden rounded-sm border">
              <span className="w-1/2" style={{ background: b.colors[0] }} />
              <span className="w-1/2" style={{ background: b.colors[1] }} />
            </span>
            {b.label}
            {boardTheme === b.id && <Check className="ml-auto" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
