"use client";

import { useExplorerSync, useKeyboardShortcuts } from "@/hooks/use-explorer-sync";
import { useExplorerStore } from "@/lib/store";
import { Header } from "@/components/layout/Header";
import { ShortcutsDialog } from "@/components/layout/ShortcutsDialog";
import { BoardColumn } from "@/components/board/BoardColumn";
import { ExplorerPanel } from "@/components/explorer/ExplorerPanel";
import { ActiveFilterChips } from "@/components/filters/ActiveFilterChips";
import { FilterSheet } from "@/components/filters/FilterSheet";
import { ImportDialog } from "@/components/players/ImportDialog";
import { PlayerManager } from "@/components/players/PlayerManager";
import { Welcome } from "@/components/onboarding/Welcome";
import { Skeleton } from "@/components/ui/skeleton";
import { TooltipProvider } from "@/components/ui/tooltip";

/**
 * --board-size is the width (and height) of the board itself:
 *   mobile : the viewport minus a 12px gutter on each side
 *   desktop: min( clamp(22rem, ~57% of the content width, 52rem),
 *                 viewport height - header (3.5rem) - chrome (8.5rem: strips + toolbar + padding) )
 * The content width is min(100vw, 1600px) minus the page padding (2rem) and the
 * board column's own side chrome (3rem: result bar + gaps).
 */
const BOARD_COLUMN =
  "[--board-size:calc(100vw-1.5rem-20px)] lg:[--board-size:min(clamp(22rem,calc((min(100vw,1600px)-2rem)*0.57-3rem),52rem),calc(100dvh-12rem))]";

function LoadingShell() {
  return (
    <div className={`mx-auto grid w-full max-w-[1600px] gap-4 px-3 py-3 sm:px-4 lg:grid-cols-[auto_minmax(0,1fr)] ${BOARD_COLUMN}`}>
      <Skeleton className="aspect-square w-[var(--board-size)]" />
      <div className="space-y-3">
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-14 w-2/3" />
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
      <div className={`flex min-h-dvh flex-col ${explorer ? "lg:h-dvh lg:overflow-hidden" : ""}`}>
        <Header showTools={explorer} />
        {!ready && <LoadingShell />}
        {ready && !hasPlayers && <Welcome />}
        {explorer && (
          <main className={`mx-auto grid min-h-0 w-full max-w-[1600px] flex-1 grid-cols-1 lg:grid-cols-[auto_minmax(0,1fr)] ${BOARD_COLUMN}`}>
            <section
              aria-label="Board"
              className="px-3 pt-3 pb-2 sm:px-4 lg:h-[calc(100dvh-3.5rem)] lg:overflow-hidden lg:pr-4 lg:pb-3"
            >
              <BoardColumn />
            </section>
            <aside
              aria-label="Explorer"
              className="flex min-w-0 flex-col gap-3 px-3 pb-6 sm:px-4 lg:h-[calc(100dvh-3.5rem)] lg:overflow-y-auto lg:pt-3 lg:pb-6 lg:pl-1"
            >
              <ActiveFilterChips />
              <ExplorerPanel />
            </aside>
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
