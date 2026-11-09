"use client";

import { useExplorerSync, useKeyboardShortcuts } from "@/hooks/use-explorer-sync";
import { useExplorerStore } from "@/lib/store";
import { Header } from "@/components/layout/Header";
import { ShortcutsDialog } from "@/components/layout/ShortcutsDialog";
import { ExplorerBoard } from "@/components/board/ExplorerBoard";
import { BoardControls } from "@/components/board/BoardControls";
import { MoveTrail } from "@/components/explorer/MoveTrail";
import { ExplorerPanel } from "@/components/explorer/ExplorerPanel";
import { ActiveFilterChips } from "@/components/filters/ActiveFilterChips";
import { FilterSheet } from "@/components/filters/FilterSheet";
import { ImportDialog } from "@/components/players/ImportDialog";
import { PlayerManager } from "@/components/players/PlayerManager";
import { Welcome } from "@/components/onboarding/Welcome";
import { Skeleton } from "@/components/ui/skeleton";
import { TooltipProvider } from "@/components/ui/tooltip";

function LoadingShell() {
  return (
    <div className="mx-auto grid w-full max-w-[1400px] gap-5 px-3 py-4 sm:px-5 lg:grid-cols-[minmax(0,1fr)_28rem]">
      <Skeleton className="aspect-square w-full" />
      <div className="space-y-3">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    </div>
  );
}

export function AppShell() {
  useExplorerSync();
  useKeyboardShortcuts();
  const ready = useExplorerStore((s) => s.ready);
  const hasPlayers = useExplorerStore((s) => s.players.length > 0);
  const explorer = ready && hasPlayers;

  return (
    <TooltipProvider>
      <div className="flex min-h-dvh flex-col">
        <Header showTools={explorer} />
        {!ready && <LoadingShell />}
        {ready && !hasPlayers && <Welcome />}
        {explorer && (
          <main className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-3 px-3 py-4 sm:px-5">
            <ActiveFilterChips />
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_28rem] lg:items-start xl:grid-cols-[minmax(0,1fr)_31rem]">
              <section aria-label="Board" className="mx-auto flex w-full max-w-[min(100%,calc(100dvh-13rem))] flex-col gap-3 lg:mx-0 lg:justify-self-center">
                <ExplorerBoard />
                <BoardControls />
                <MoveTrail />
              </section>
              <aside aria-label="Explorer" className="lg:sticky lg:top-[4.5rem] lg:max-h-[calc(100dvh-5.5rem)] lg:overflow-y-auto lg:pr-1">
                <ExplorerPanel />
              </aside>
            </div>
          </main>
        )}
        <FilterSheet />
        <ImportDialog />
        <PlayerManager />
        <ShortcutsDialog />
      </div>
    </TooltipProvider>
  );
}
