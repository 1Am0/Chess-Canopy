"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronDown } from "lucide-react";
import type { NextMove } from "@/lib/engine/types";
import { useExplorerStore } from "@/lib/store";
import { score } from "@/lib/format";
import { lookupOpening } from "@/lib/openings/lookup";
import { usePosition } from "@/hooks/use-position";
import { MoveRow } from "@/components/explorer/MoveRow";
import { cn } from "@/lib/utils";

type SortKey = "games" | "score" | "move";

export function MoveTable({ next, total }: { next: NextMove[]; total: number }) {
  const playMove = useExplorerStore((s) => s.playMove);
  const setHoverMove = useExplorerStore((s) => s.setHoverMove);
  const { visible, key: posKey } = usePosition();
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "games", dir: "desc" });
  const [active, setActive] = useState(0);
  const [focused, setFocused] = useState(false);
  const [showRare, setShowRare] = useState(false);
  const [seenKey, setSeenKey] = useState(posKey);

  // Reset transient state when the position changes (adjust-during-render pattern).
  if (seenKey !== posKey) {
    setSeenKey(posKey);
    setShowRare(false);
    setActive(0);
  }

  const currentName = useMemo(() => lookupOpening(visible)?.name ?? null, [visible]);

  const sorted = useMemo(() => {
    const out = [...next];
    const m = sort.dir === "asc" ? 1 : -1;
    out.sort((a, b) => {
      if (sort.key === "move") return m * a.move.localeCompare(b.move);
      if (sort.key === "score") return m * (score(a.stats) - score(b.stats)) || b.stats.total - a.stats.total;
      return m * (a.stats.total - b.stats.total) || a.move.localeCompare(b.move);
    });
    return out;
  }, [next, sort]);

  const threshold = Math.max(3, total * 0.01);
  const { common, rare } = useMemo(() => {
    const c = sorted.filter((r) => r.stats.total >= threshold);
    // If nothing is common, never hide everything.
    if (c.length === 0) return { common: sorted, rare: [] as NextMove[] };
    return { common: c, rare: sorted.filter((r) => r.stats.total < threshold) };
  }, [sorted, threshold]);

  const rows = showRare ? [...common, ...rare] : common;
  const idx = Math.min(active, Math.max(rows.length - 1, 0));

  const openingFor = (san: string) => {
    const name = lookupOpening([...visible, san])?.name ?? null;
    return name && name !== currentName ? name : null;
  };

  const toggle = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "desc" ? "asc" : "desc" } : { key, dir: key === "move" ? "asc" : "desc" }));

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.target !== e.currentTarget || !rows.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const n = Math.min(idx + 1, rows.length - 1);
      setActive(n);
      setHoverMove(rows[n].move);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const n = Math.max(idx - 1, 0);
      setActive(n);
      setHoverMove(rows[n].move);
    } else if (e.key === "Enter") {
      e.preventDefault();
      playMove(rows[idx].move);
      setActive(0);
    }
  };

  const Th = ({ k, label, className }: { k: SortKey; label: string; className?: string }) => (
    <th scope="col" className={cn("px-2 py-1.5 font-medium", className)} aria-sort={sort.key === k ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
      <button
        type="button"
        onClick={() => toggle(k)}
        className={cn(
          "inline-flex items-center gap-0.5 whitespace-nowrap rounded-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60",
          sort.key === k && "text-foreground",
        )}
      >
        {label}
        {sort.key === k && (sort.dir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
      </button>
    </th>
  );

  return (
    <div
      data-local-keys
      tabIndex={0}
      role="group"
      aria-label="Candidate moves. Use up and down arrows to select, Enter to play."
      aria-activedescendant={rows.length ? `move-row-${idx}` : undefined}
      onKeyDown={onKeyDown}
      onFocus={(e) => {
        if (e.target === e.currentTarget) setFocused(true);
      }}
      onBlur={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) {
          if (e.target === e.currentTarget) setFocused(false);
          return;
        }
        setFocused(false);
        setHoverMove(null);
      }}
      className="overflow-hidden rounded-lg border bg-card outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <table className="w-full table-fixed border-collapse text-left sm:table-auto">
        <thead className="text-xs text-muted-foreground">
          <tr className="bg-muted/50">
            <Th k="move" label="Move" className="pl-3" />
            <Th k="games" label="Games" className="w-16 pr-3 text-right sm:w-auto sm:pr-2" />
            <th scope="col" className="hidden px-2 py-1.5 text-right font-medium sm:table-cell">Share</th>
            <th scope="col" className="w-[7.5rem] pr-2 pl-3 py-1.5 font-medium sm:w-[34%] sm:px-2">W / D / L</th>
            <Th k="score" label="Score" className="w-12 pr-3 text-right sm:w-auto" />
          </tr>
        </thead>
        <tbody>
          {common.map((item, i) => (
            <MoveRow key={item.move} {...rowProps(item, i)} />
          ))}
          {rare.length > 0 && (
            <tr className="border-t">
              {([["sm:hidden", 4], ["hidden sm:table-cell", 5]] as const).map(([cls, span]) => (
                <td key={span} colSpan={span} className={cn("p-0", cls)}>
                  <button
                    type="button"
                    aria-expanded={showRare}
                    onClick={() => setShowRare((v) => !v)}
                    className="flex w-full items-center justify-center gap-1 px-3 py-1.5 text-xs text-muted-foreground outline-none hover:bg-accent/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/60"
                  >
                    {showRare ? "Hide" : "Show"} {rare.length} rare {rare.length === 1 ? "move" : "moves"}
                    <ChevronDown className={cn("size-3.5 transition-transform", showRare && "rotate-180")} />
                  </button>
                </td>
              ))}
            </tr>
          )}
          {showRare && rare.map((item, j) => <MoveRow key={item.move} {...rowProps(item, common.length + j, true)} />)}
        </tbody>
      </table>
    </div>
  );

  function rowProps(item: NextMove, i: number, isRare = false) {
    return {
      id: `move-row-${i}`,
      item,
      positionTotal: total,
      active: focused && i === idx,
      openingName: openingFor(item.move),
      rare: isRare,
      onPlay: () => {
        playMove(item.move);
        setActive(0);
      },
      onHover: (h: boolean) => {
        setHoverMove(h ? item.move : null);
        if (h) setActive(i);
      },
    };
  }
}
