"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import type { NextMove } from "@/lib/engine/types";
import { useExplorerStore } from "@/lib/store";
import { score } from "@/lib/format";
import { MoveRow } from "@/components/explorer/MoveRow";
import { cn } from "@/lib/utils";

type SortKey = "games" | "score" | "move";

export function MoveTable({ next, total }: { next: NextMove[]; total: number }) {
  const playMove = useExplorerStore((s) => s.playMove);
  const setHoverMove = useExplorerStore((s) => s.setHoverMove);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "games", dir: "desc" });
  const [active, setActive] = useState(0);
  const [focused, setFocused] = useState(false);

  const rows = useMemo(() => {
    const out = [...next];
    const m = sort.dir === "asc" ? 1 : -1;
    out.sort((a, b) => {
      if (sort.key === "move") return m * a.move.localeCompare(b.move);
      if (sort.key === "score") return m * (score(a.stats) - score(b.stats)) || b.stats.total - a.stats.total;
      return m * (a.stats.total - b.stats.total) || a.move.localeCompare(b.move);
    });
    return out;
  }, [next, sort]);

  const idx = Math.min(active, Math.max(rows.length - 1, 0));

  const toggle = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "desc" ? "asc" : "desc" } : { key, dir: key === "move" ? "asc" : "desc" }));

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!rows.length) return;
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
          "inline-flex items-center gap-0.5 rounded-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60",
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
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        setHoverMove(null);
      }}
      className="overflow-hidden rounded-lg border outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <table className="w-full border-collapse text-left">
        <thead className="bg-muted/50 text-xs text-muted-foreground">
          <tr>
            <Th k="move" label="Move" className="pl-3" />
            <Th k="games" label="Games" className="text-right" />
            <th scope="col" className="px-2 py-1.5 text-right font-medium">Share</th>
            <th scope="col" className="px-2 py-1.5 font-medium">Win / Draw / Loss</th>
            <Th k="score" label="Score" className="pr-3 text-right" />
          </tr>
        </thead>
        <tbody>
          {rows.map((item, i) => (
            <MoveRow
              key={item.move}
              id={`move-row-${i}`}
              item={item}
              positionTotal={total}
              active={focused && i === idx}
              onPlay={() => {
                playMove(item.move);
                setActive(0);
              }}
              onHover={(h) => {
                setHoverMove(h ? item.move : null);
                if (h) setActive(i);
              }}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
