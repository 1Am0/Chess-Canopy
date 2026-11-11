"use client";

import { Filter, HelpCircle, Plus } from "lucide-react";
import { activeFilterCount, useExplorerStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { ImportIndicator } from "@/components/players/ImportIndicator";
import { PlayerSwitcher } from "@/components/players/PlayerSwitcher";
import { Logo } from "@/components/layout/Logo";
import { MoreMenu } from "@/components/layout/MoreMenu";
import { SoundToggle } from "@/components/layout/SoundToggle";

export function Header({ showTools }: { showTools: boolean }) {
  const filters = useExplorerStore((s) => s.filters);
  const setUi = useExplorerStore((s) => s.setUi);
  const count = activeFilterCount(filters);

  return (
    <header
      className="sticky top-0 z-[5] bg-card shadow-[0_1px_0_0_var(--border)] forced-colors:border-b"
    >
      <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-2 px-3 sm:px-4">
        <div className="mr-1 flex shrink-0 items-center gap-2 text-primary">
          <Logo className="size-7" />
          <span className="hidden text-xl leading-none font-semibold tracking-tight text-foreground sm:inline">Chess Canopy</span>
        </div>
        {showTools && <div className="min-w-0 shrink" data-testid="player-switcher"><PlayerSwitcher /></div>}
        <div className="ml-auto flex shrink-0 items-center gap-1.5 max-sm:gap-2">
          {showTools && <ImportIndicator />}
          {showTools && (
            <Button variant="outline" size="sm" className="max-sm:h-9 max-sm:px-2.5" onClick={() => setUi({ filtersOpen: true })} aria-label={`Filters${count ? `, ${count} active` : ""}`}>
              <Filter />
              <span className="hidden sm:inline">Filters</span>
              {count > 0 && (
                <span className="ml-0.5 flex h-5 min-w-5 items-center justify-center rounded-sm bg-primary px-1 font-mono text-xs font-semibold text-primary-foreground tabular-nums">
                  {count}
                </span>
              )}
            </Button>
          )}
          {showTools && (
            <Button variant="outline" size="sm" className="max-sm:h-9 max-sm:px-2.5" onClick={() => setUi({ importOpen: true })} aria-label="Import games">
              <Plus />
              <span className="hidden sm:inline">Import</span>
            </Button>
          )}
          <SoundToggle className="max-sm:hidden" />
          <MoreMenu />
          <Button variant="outline" size="icon" className="max-sm:hidden" onClick={() => setUi({ shortcutsOpen: true })} aria-label="Keyboard shortcuts">
            <HelpCircle />
          </Button>
        </div>
      </div>
    </header>
  );
}
