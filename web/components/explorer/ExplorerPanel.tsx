"use client";

import { useState } from "react";
import { useExplorerStore, type ExplorerView } from "@/lib/store";
import { useMediaQuery } from "@/hooks/use-media-query";
import { CanopyView } from "@/components/canopy/CanopyView";
import { SideSwitch } from "@/components/layout/SideSwitch";
import { FilterRow } from "@/components/filters/FilterRow";
import { LinePanel } from "@/components/explorer/LinePanel";
import { PositionAnnouncer } from "@/components/explorer/PositionAnnouncer";
import { OpeningHeader } from "@/components/explorer/OpeningHeader";
import { PositionSummary } from "@/components/explorer/PositionSummary";
import { MoveTable } from "@/components/explorer/MoveTable";
import { GamesList } from "@/components/explorer/GamesList";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Tab = ExplorerView;

const TRIGGER =
  "h-full flex-1 rounded-none border-0 bg-transparent px-3 text-muted-foreground shadow-none hover:text-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-[inset_0_-2px_0_var(--color-primary)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:outline-none dark:data-[state=active]:border-transparent dark:data-[state=active]:bg-transparent lg:flex-none lg:px-4";

/** Panels are always mounted (state and data stay warm); inactive ones are display:none. */
const PANEL = "min-h-0 flex-none overflow-hidden data-[state=inactive]:hidden lg:flex-1";

/**
 * The workspace column, as a stack of fixed-height slots so nothing moves when moves
 * are played (Lichess / chess.com style):
 *
 *   desktop (lg+, exactly the viewport height under the header, no outer scroll):
 *     SideSwitch 44 · opening 28 · filters 32 · Line strip 44 · summary 52 ·
 *     explorer region (flex 1) with tabs Moves | Games, each its own scroll region.
 *   mobile: SideSwitch · opening · filters · summary · tabs Moves | Games over a
 *     panel of fixed height max(22rem, 45vh), so tab switches never change page height.
 */
export function ExplorerPanel() {
  const value = useExplorerStore((s) => s.explorerView);
  const setTab = useExplorerStore((s) => s.setExplorerView);
  const canopyExpanded = useExplorerStore((s) => s.canopyExpanded);
  const lg = useMediaQuery("(min-width: 1024px)");
  // The canopy mounts on its first visit and then stays mounted (hidden panels neither draw nor fetch).
  const [canopySeen, setCanopySeen] = useState(value === "canopy");
  if (value === "canopy" && !canopySeen) setCanopySeen(true);
  // Expanded: the line strip, summary and tab bar make room; the board column never moves.
  const expanded = lg && value === "canopy" && canopyExpanded;

  return (
    <div className="flex min-w-0 flex-col gap-2 lg:h-full lg:min-h-0">
      <PositionAnnouncer />
      <SideSwitch />
      <OpeningHeader />
      <FilterRow />
      <LinePanel className={expanded ? "hidden" : undefined} />
      <PositionSummary className={expanded ? "hidden" : undefined} />
      <Tabs
        value={value}
        onValueChange={(v) => setTab(v as Tab)}
        data-testid="explorer-region"
        className={`gap-0 overflow-hidden rounded-lg border bg-card lg:min-h-[13rem] lg:flex-1${expanded ? " hidden" : ""}`}
      >
        <TabsList aria-label="Explorer views" className="h-9 w-full shrink-0 justify-start gap-0 rounded-none border-b bg-transparent p-0">
          <TabsTrigger value="moves" className={TRIGGER}>Moves</TabsTrigger>
          <TabsTrigger value="games" className={TRIGGER}>Games</TabsTrigger>
          <TabsTrigger value="canopy" className={TRIGGER}>Canopy</TabsTrigger>
        </TabsList>
        <TabsContent value="moves" forceMount tabIndex={-1} className={`${PANEL} h-[max(22rem,45vh)] lg:h-auto`}>
          <MoveTable />
        </TabsContent>
        <TabsContent value="games" forceMount tabIndex={-1} className={`${PANEL} h-[max(22rem,45vh)] lg:h-auto`}>
          <GamesList active={value === "games"} />
        </TabsContent>
        {canopySeen && (
          <TabsContent value="canopy" forceMount tabIndex={-1} className={`${PANEL} h-[max(22rem,45vh)] lg:h-auto`}>
            <CanopyView variant="compact" active={value === "canopy" && !expanded} />
          </TabsContent>
        )}
      </Tabs>
      {expanded && (
        <section
          aria-label="Canopy, expanded"
          data-testid="canopy-expanded"
          className="min-h-0 flex-1 overflow-hidden rounded-lg border bg-card"
        >
          <CanopyView variant="expanded" active />
        </section>
      )}
    </div>
  );
}
