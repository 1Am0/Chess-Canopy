"use client";

import { FilterX, RotateCcw } from "lucide-react";
import { useExplorerStore } from "@/lib/store";
import { usePosition } from "@/hooks/use-position";
import { SideSwitch } from "@/components/layout/SideSwitch";
import { LinePanel } from "@/components/explorer/LinePanel";
import { OpeningHeader } from "@/components/explorer/OpeningHeader";
import { PositionSummary } from "@/components/explorer/PositionSummary";
import { MoveTable } from "@/components/explorer/MoveTable";
import { GamesList } from "@/components/explorer/GamesList";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function MovesSection() {
  const result = useExplorerStore((s) => s.result);
  const summary = useExplorerStore((s) => s.summary);
  const loading = useExplorerStore((s) => s.resultLoading);
  const clearFilters = useExplorerStore((s) => s.clearFilters);
  const toStart = useExplorerStore((s) => s.toStart);
  const undo = useExplorerStore((s) => s.undo);
  const { visible } = usePosition();

  if (!result) {
    return (
      <div className="space-y-2" aria-busy="true" aria-label="Loading moves">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-full" />
        ))}
      </div>
    );
  }
  if (summary && summary.games === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed px-4 py-8 text-center">
        <FilterX className="size-6 text-muted-foreground" />
        <div>
          <p className="font-medium">No games match these filters</p>
          <p className="text-sm text-muted-foreground">Loosen or clear the filters to see your moves.</p>
        </div>
        <Button size="sm" variant="outline" onClick={clearFilters}>Clear filters</Button>
      </div>
    );
  }
  if (result.next.length === 0) {
    const outOfBook = visible.length > 0;
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed px-4 py-8 text-center">
        <div>
          <p className="font-medium">{outOfBook ? "Out of book" : "No moves found"}</p>
          <p className="text-sm text-muted-foreground">
            {outOfBook
              ? result.stats.total > 0
                ? "Your games end here. No further moves were played from this position."
                : "None of your games reached this position."
              : "There are no games for the current selection."}
          </p>
        </div>
        {outOfBook && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={undo}>Step back</Button>
            <Button size="sm" variant="outline" onClick={toStart}><RotateCcw /> Start</Button>
          </div>
        )}
      </div>
    );
  }
  return (
    <div className={loading ? "opacity-70 transition-opacity" : "transition-opacity"}>
      <MoveTable next={result.next} total={result.stats.total} />
    </div>
  );
}

export function ExplorerPanel() {
  return (
    <div className="flex flex-col gap-3">
      <SideSwitch />
      <OpeningHeader />
      {/* Mobile: summary then tabs. Desktop (lg): tabs dissolve and sections stack in order. */}
      <PositionSummary className="order-1 lg:order-2" />
      <Tabs defaultValue="moves" className="order-2 gap-3 lg:contents">
        <TabsList className="w-full lg:hidden">
          <TabsTrigger value="moves">Moves</TabsTrigger>
          <TabsTrigger value="line">Line</TabsTrigger>
          <TabsTrigger value="games">Games</TabsTrigger>
        </TabsList>
        <TabsContent value="line" forceMount className="data-[state=inactive]:hidden lg:order-1 lg:data-[state=inactive]:block">
          <LinePanel />
        </TabsContent>
        <TabsContent value="moves" forceMount className="data-[state=inactive]:hidden lg:order-3 lg:data-[state=inactive]:block">
          <MovesSection />
        </TabsContent>
        <TabsContent value="games" forceMount className="data-[state=inactive]:hidden lg:order-4 lg:data-[state=inactive]:block">
          <GamesList />
        </TabsContent>
      </Tabs>
    </div>
  );
}
