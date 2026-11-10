"use client";

import { useMemo } from "react";
import { ChevronRight, Minimize2, X } from "lucide-react";
import { moveLabel } from "@/lib/canopy/labels";
import { lookupOpening } from "@/lib/openings/lookup";
import { pct, score } from "@/lib/format";
import { useExplorerStore } from "@/lib/store";
import { usePosition } from "@/hooks/use-position";
import { WdbBar } from "@/components/explorer/WdbBar";
import { scoreTextClass } from "@/components/explorer/wdb";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const MAX_CRUMBS = 5;

/**
 * Expanded and sheet header: where the canopy is rooted (a breadcrumb of the last five moves,
 * each a jump back to that position), the root summary, and the way out. It takes the place of
 * the line strip and the position summary, which are hidden in these modes.
 */
export function CanopyHeader({ variant, onClose }: { variant: "expanded" | "sheet"; onClose: () => void }) {
  const { visible } = usePosition();
  const goTo = useExplorerStore((s) => s.goTo);
  const result = useExplorerStore((s) => s.result);
  const side = useExplorerStore((s) => s.filters.color ?? "white");
  const opening = useMemo(() => lookupOpening(visible), [visible]);
  const sheet = variant === "sheet";

  const first = Math.max(0, visible.length - MAX_CRUMBS);
  const crumbs = visible.slice(first).map((san, k) => ({ ply: first + k, san }));
  const stats = result?.stats;
  const total = stats?.total ?? 0;
  const sc = stats ? score(stats) : 0;

  return (
    <header
      data-testid="canopy-header"
      className={cn("flex shrink-0 items-center gap-3 border-b bg-card px-3", sheet ? "h-12 pt-[env(safe-area-inset-top)] box-content" : "h-10")}
    >
      <nav aria-label="Canopy root" className="min-w-0 flex-1">
        <ol className="flex min-w-0 items-center gap-0.5 overflow-hidden whitespace-nowrap">
          <li className="shrink-0">
            <Crumb current={visible.length === 0} onClick={() => goTo(0)}>
              Start
            </Crumb>
          </li>
          {first > 0 && (
            <li className="flex shrink-0 items-center text-muted-foreground" aria-hidden>
              <Sep />
              <span className="px-1 text-xs">…</span>
            </li>
          )}
          {crumbs.map((c, k) => (
            <li key={c.ply} className="flex shrink-0 items-center">
              <Sep />
              <Crumb mono current={k === crumbs.length - 1} onClick={() => goTo(c.ply + 1)}>
                {moveLabel(c.ply, c.san)}
              </Crumb>
            </li>
          ))}
        </ol>
        {sheet && (
          <p className="truncate pl-1.5 text-[11px] leading-4 text-muted-foreground">{opening ? opening.name : visible.length ? "Out of book" : "Starting position"}</p>
        )}
      </nav>

      <p className="flex shrink-0 items-center gap-2 text-xs whitespace-nowrap tabular-nums" aria-label="Root summary">
        {result ? (
          <>
            <span>
              <span className="font-semibold">{total.toLocaleString()}</span> <span className="text-muted-foreground">{total === 1 ? "game" : "games"}</span>
            </span>
            {total > 0 && (
              <>
                <span aria-hidden className="text-muted-foreground">·</span>
                <span className={cn("font-semibold", scoreTextClass(sc, total))}>{pct(sc)}</span>
                <WdbBar stats={stats} side={side} labels={false} className="hidden h-1.5 w-[72px] sm:flex" />
              </>
            )}
          </>
        ) : null}
      </p>

      {sheet ? (
        <Button type="button" variant="ghost" size="icon" aria-label="Close" onClick={onClose} className="-mr-1 size-10 text-muted-foreground hover:text-foreground">
          <X />
        </Button>
      ) : (
        <Button type="button" variant="ghost" size="sm" aria-label="Collapse" title="Collapse (Esc)" onClick={onClose} className="-mr-1 h-8 gap-1.5 px-2 text-muted-foreground hover:text-foreground">
          <Minimize2 className="size-3.5" />
          <span className="hidden sm:inline">Collapse</span>
        </Button>
      )}
    </header>
  );
}

function Sep() {
  return <ChevronRight aria-hidden className="size-3 shrink-0 text-muted-foreground/60" />;
}

function Crumb({ children, current, mono, onClick }: { children: React.ReactNode; current: boolean; mono?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={current ? "location" : undefined}
      className={cn(
        "rounded-sm px-1.5 py-0.5 text-sm outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/60",
        mono && "font-mono text-[13px]",
        current ? "font-semibold text-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
