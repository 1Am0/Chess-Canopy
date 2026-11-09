"use client";

import { ChevronsUpDown, Settings2, Users } from "lucide-react";
import { effectiveSelection, useExplorerStore } from "@/lib/store";
import { sourceLabel } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";

export function PlayerSwitcher() {
  const players = useExplorerStore((s) => s.players);
  const selected = useExplorerStore((s) => s.selected);
  const setSelected = useExplorerStore((s) => s.setSelected);
  const setUi = useExplorerStore((s) => s.setUi);

  const eff = effectiveSelection(selected, players);
  const isAll = eff === "all";
  const chosen = isAll ? players : players.filter((p) => eff.includes(p.id));
  const total = chosen.reduce((n, p) => n + p.gameCount, 0);
  const label = isAll ? "All players" : chosen.length === 1 ? chosen[0].displayName : `${chosen.length} players`;

  const toggle = (id: string) => {
    const base = isAll ? players.map((p) => p.id) : eff;
    const next = base.includes(id) ? base.filter((x) => x !== id) : [...base, id];
    setSelected(next.length === 0 || next.length === players.length ? "all" : next);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="max-w-[11rem] justify-between gap-2 sm:max-w-xs" aria-label={`Players: ${label}`}>
          <Users className="text-muted-foreground" />
          <span className="truncate">{label}</span>
          <span className="hidden min-w-[5ch] text-right text-xs text-muted-foreground tabular-nums sm:inline">{total.toLocaleString()}</span>
          <ChevronsUpDown className="size-3.5 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-1.5">
        <label className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 text-sm hover:bg-accent">
          <Checkbox checked={isAll} onCheckedChange={() => setSelected("all")} aria-label="All players" />
          <span className="flex-1 font-medium">All players</span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {players.reduce((n, p) => n + p.gameCount, 0).toLocaleString()}
          </span>
        </label>
        <Separator className="my-1" />
        <ul>
          {players.map((p) => (
            <li key={p.id}>
              <label className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 text-sm hover:bg-accent">
                <Checkbox checked={isAll || eff.includes(p.id)} onCheckedChange={() => toggle(p.id)} aria-label={p.displayName} />
                <span className="min-w-0 flex-1 truncate">{p.displayName}</span>
                <Badge variant="outline" className="text-[10px]">{sourceLabel(p.source)}</Badge>
                <span className="w-9 text-right text-xs text-muted-foreground tabular-nums">{p.gameCount.toLocaleString()}</span>
              </label>
            </li>
          ))}
        </ul>
        <Separator className="my-1" />
        <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => setUi({ managerOpen: true })}>
          <Settings2 /> Manage players…
        </Button>
      </PopoverContent>
    </Popover>
  );
}
