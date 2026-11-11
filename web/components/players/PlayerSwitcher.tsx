"use client";

import { ChevronsUpDown, Settings2, Users } from "lucide-react";
import { effectiveSelection, useExplorerStore } from "@/lib/store";
import { sourceLabel } from "@/lib/format";
import { PaperLabel } from "@/components/paper";
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
    // The last selected player can't be unchecked (it used to silently select everyone).
    if (base.includes(id) && base.length === 1 && !isAll) return;
    const next = base.includes(id) ? base.filter((x) => x !== id) : [...base, id];
    setSelected(next.length === 0 || next.length === players.length ? "all" : next);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="relative w-full min-w-0 max-w-[11rem] justify-between gap-1.5 px-2.5 max-sm:h-9 sm:max-w-xs sm:gap-2 sm:px-4"
          aria-label={`Players: ${label}, ${total.toLocaleString()} games`}
        >
          <Users className="text-muted-foreground" />
          <span className="hidden min-w-0 truncate min-[380px]:inline">{label}</span>
          {/* narrow phones: icon + game count, the full name stays in the accessible name */}
          <span className="min-w-[2ch] text-right text-xs text-muted-foreground tabular-nums min-[380px]:hidden sm:inline sm:min-w-[5ch]">{total.toLocaleString()}</span>
          <ChevronsUpDown className="size-3.5 text-muted-foreground" />
          {/* the label's folded corner: a dog-ear with a darker underside and a soft shadow */}
          <span aria-hidden className="paper-deco pointer-events-none absolute -top-px -right-px size-3.5">
            <span className="absolute inset-0 bg-[var(--strip)] [clip-path:polygon(0_0,100%_0,100%_100%)]" style={{ backgroundImage: "var(--sheet-tile)" }} />
            <span className="absolute inset-0 [clip-path:polygon(0_0,100%_100%,0_100%)] [background:linear-gradient(135deg,var(--sheet-under),var(--sheet-flat))] drop-shadow-[-1px_1px_1px_var(--btn-drop)]" />
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-2" aria-label="Choose players">
        <p className="kicker mb-0 px-2 pt-1 pb-0.5">Collection</p>
        <label className="paper-row flex cursor-pointer items-baseline gap-2.5 px-2 py-2 text-sm hover:before:opacity-100 has-[:focus-visible]:before:opacity-100">
          <Checkbox className="self-center" checked={isAll} onCheckedChange={() => setSelected("all")} aria-label="All players" />
          <span className="font-serif text-base font-semibold italic">All players</span>
          <span className="leader" aria-hidden="true" />
          <span className="font-mono text-xs text-muted-foreground tabular-nums">
            {players.reduce((n, p) => n + p.gameCount, 0).toLocaleString()}
          </span>
        </label>
        <Separator variant="pencil" className="my-1" />
        <ul>
          {players.map((p) => (
            <li key={p.id}>
              <label className="paper-row flex cursor-pointer items-baseline gap-2 px-2 py-2 text-sm hover:before:opacity-100 has-[:focus-visible]:before:opacity-100">
                <Checkbox className="self-center" checked={isAll || eff.includes(p.id)} disabled={!isAll && eff.length === 1 && eff.includes(p.id)} onCheckedChange={() => toggle(p.id)} aria-label={p.displayName} />
                <span className="min-w-0 truncate font-serif text-base italic">{p.displayName}</span>
                <PaperLabel tone="manila" className="self-center text-[10px] leading-4">{sourceLabel(p.source)}</PaperLabel>
                <span className="leader" aria-hidden="true" />
                <span className="min-w-9 text-right font-mono text-xs text-muted-foreground tabular-nums">{p.gameCount.toLocaleString()}</span>
              </label>
            </li>
          ))}
        </ul>
        <Separator variant="pencil" className="my-1" />
        <Button variant="secondary" size="sm" className="w-full justify-start" onClick={() => setUi({ managerOpen: true })}>
          <Settings2 /> Manage players…
        </Button>
      </PopoverContent>
    </Popover>
  );
}
