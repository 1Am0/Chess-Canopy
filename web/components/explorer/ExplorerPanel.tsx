"use client";

import { useState } from "react";
import { SideSwitch } from "@/components/layout/SideSwitch";
import { FilterRow } from "@/components/filters/FilterRow";
import { LinePanel } from "@/components/explorer/LinePanel";
import { PositionAnnouncer } from "@/components/explorer/PositionAnnouncer";
import { OpeningHeader } from "@/components/explorer/OpeningHeader";
import { PositionSummary } from "@/components/explorer/PositionSummary";
import { MoveTable } from "@/components/explorer/MoveTable";
import { GamesList } from "@/components/explorer/GamesList";
import { CanopyTree } from "@/components/explorer/CanopyTree";
import { bestCandidate } from "@/components/explorer/best-move";
import { useExplorerStore } from "@/lib/store";
import { pct } from "@/lib/format";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Tab = "moves" | "games" | "canopy";

/** Panels are always mounted (state and data stay warm); inactive ones are display:none. */
const PANEL = "min-h-0 flex-none overflow-hidden data-[state=inactive]:hidden lg:flex-1";

/**
 * The workspace column, as a stack of fixed-height slots so nothing moves when moves
 * are played (Lichess / chess.com style):
 *
 *   desktop (lg+, exactly the viewport height under the header, no outer scroll):
 *     SideSwitch 44 · opening 28 · filters 32 · Line strip 44 · summary 52 ·
 *     explorer region (flex 1) with tabs Moves | Games | Canopy, each its own scroll region.
 *   mobile: SideSwitch · opening · filters · summary · tabs Moves | Games | Canopy over a
 *     panel of fixed height max(22rem, 45vh), so tab switches never change page height.
 */
export function ExplorerPanel() {
  const [tab, setTab] = useState<Tab>("moves");
  const value: Tab = tab;
  const result = useExplorerStore((s) => s.result);
  const fresh = useExplorerStore((s) => !s.resultLoading && s.result != null);
  // A short hint, only when it is a real comparison (see best-move.ts).
  const best = fresh && result ? bestCandidate(result.next, result.stats.total) : null;
  const note = best ? `Best for you: ${best.move} (${pct(best.score)})` : null;

  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-lg border border-border bg-card p-[11px] pt-[15px] lg:h-full lg:min-h-0">
      <PositionAnnouncer />
      <SideSwitch />
      <OpeningHeader />
      <FilterRow />
      <LinePanel />
      <PositionSummary note={note} />
      <Tabs
        value={value}
        onValueChange={(v) => setTab(v as Tab)}
        data-testid="explorer-region"
        className="gap-0 overflow-hidden lg:min-h-[13rem] lg:flex-1"
      >
        <TabsList aria-label="Explorer views" className="h-9 w-full shrink-0 justify-start">
          <TabsTrigger value="moves" className="lg:flex-none lg:px-5">Moves</TabsTrigger>
          <TabsTrigger value="games" className="lg:flex-none lg:px-5">Games</TabsTrigger>
          <TabsTrigger value="canopy" className="lg:flex-none lg:px-5">Canopy</TabsTrigger>
        </TabsList>
        <TabsContent value="moves" forceMount tabIndex={-1} className={`${PANEL} h-[max(22rem,45vh)] lg:h-auto`}>
          <MoveTable />
        </TabsContent>
        <TabsContent value="games" forceMount tabIndex={-1} className={`${PANEL} h-[max(22rem,45vh)] lg:h-auto`}>
          <GamesList active={value === "games"} />
        </TabsContent>
        <TabsContent value="canopy" forceMount tabIndex={-1} className={`${PANEL} h-[max(22rem,45vh)] lg:h-auto`}>
          <CanopyTree active={value === "canopy"} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
