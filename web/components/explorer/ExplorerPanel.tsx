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
import { PaperSheet, Tape, UnderSheet } from "@/components/paper";
import { bestCandidate } from "@/components/explorer/best-move";
import { useExplorerStore } from "@/lib/store";
import { pct } from "@/lib/format";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Tab = "moves" | "games" | "canopy";

/**
 * Folder tabs (see the `folder-tab` utility): the active tab is the same paper as the panel and
 * stands in the h-9 slot; inactive tabs are a shade darker and sit 4px lower, slightly behind.
 */
const TRIGGER =
  "folder-tab h-[calc(100%-4px)] flex-1 self-end rounded-none border-0 bg-transparent px-3 text-muted-foreground shadow-none hover:text-foreground data-[state=active]:h-full data-[state=active]:bg-transparent data-[state=active]:font-semibold data-[state=active]:text-ink data-[state=active]:shadow-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:outline-none dark:data-[state=active]:border-transparent dark:data-[state=active]:bg-transparent lg:flex-none lg:px-5";

/** Panels are always mounted (state and data stay warm); inactive ones are display:none. */
const PANEL = "min-h-0 flex-none overflow-hidden rounded-none border-t border-rule data-[state=inactive]:hidden lg:flex-1";

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
  // A pencilled margin note, only when it is a real comparison (see best-move.ts).
  const best = fresh && result ? bestCandidate(result.next, result.stats.total) : null;
  const note = best ? `best for you: ${best.move} · ${pct(best.score)}` : null;

  return (
    // One cream sheet with a second sheet peeking out from under it and a strip of tape across its top edge.
    <div className="relative isolate z-10 min-w-0 lg:h-full lg:min-h-0">
    <UnderSheet seed={7} dx={7} dy={8} rotate={-1} />
    <PaperSheet className="@container/sheet flex min-w-0 flex-col gap-2 p-3 pt-4 lg:h-full lg:min-h-0">
      {/* tape on both top corners; narrow sheets carry the margin note on the left strip, wide ones beside the summary */}
      <Tape variant="ochre" angle={-3} seed="top-l" className="-top-1.5 left-6 hidden @[38rem]/sheet:block" />
      <Tape variant="ochre" length={note ? 200 : 120} angle={-3} seed="top-l" label={note} className="-top-1.5 left-6 @[38rem]/sheet:hidden" />
      <Tape variant="ochre" angle={2.5} seed="top-r" className="-top-1.5 right-6" />
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
        <TabsList aria-label="Explorer views" className="h-9 w-full shrink-0 justify-start gap-0.5 rounded-none border-b-0 bg-transparent p-0">
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
        <TabsContent value="canopy" forceMount tabIndex={-1} className={`${PANEL} h-[max(22rem,45vh)] lg:h-auto`}>
          <CanopyTree active={value === "canopy"} />
        </TabsContent>
      </Tabs>
    </PaperSheet>
    </div>
  );
}
