"use client";

import { Filter, HelpCircle, Plus } from "lucide-react";
import { activeFilterCount, useExplorerStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { ImportIndicator } from "@/components/players/ImportIndicator";
import { PlayerSwitcher } from "@/components/players/PlayerSwitcher";
import { Logo } from "@/components/layout/Logo";
import { MoreMenu } from "@/components/layout/MoreMenu";
import { SoundToggle } from "@/components/layout/SoundToggle";
import { TornEdge } from "@/components/paper";

export function Header({ showTools }: { showTools: boolean }) {
  const filters = useExplorerStore((s) => s.filters);
  const setUi = useExplorerStore((s) => s.setUi);
  const count = activeFilterCount(filters);

  return (
    <header
      className={`paper-scope sticky top-0 z-20 bg-[var(--strip)] forced-colors:border-b ${showTools ? "lg:h-dvh lg:w-48 lg:shrink-0 lg:border-r lg:border-rule" : ""}`}
      style={{ backgroundImage: "var(--sheet-tile)" }}
    >
      {/* a torn strip of cream paper laid across the top of the desk */}
      <TornEdge seed={11} className={showTools ? "lg:hidden" : undefined} />
      <div className={`mx-auto flex h-14 max-w-[1600px] items-center gap-2 px-3 sm:px-4 ${showTools ? "lg:h-full lg:max-w-none lg:flex-col lg:items-stretch lg:gap-3 lg:px-3 lg:py-4" : ""}`}>
        <div className="mr-1 flex shrink-0 items-center gap-2 text-primary">
          <Logo className="size-7" />
          <span className="hidden font-serif text-xl leading-none font-semibold tracking-tight text-foreground sm:inline">Chess Canopy</span>
        </div>
        {showTools && <div className="min-w-0 shrink lg:shrink-0" data-testid="player-switcher"><PlayerSwitcher /></div>}
        <div className="ml-auto flex shrink-0 items-center gap-1.5 max-sm:gap-2 lg:ml-0 lg:min-h-0 lg:flex-1 lg:flex-col lg:items-stretch">
          {showTools && <ImportIndicator />}
          {showTools && (
            <Button variant="outline" size="sm" className="max-sm:h-9 max-sm:px-2.5 lg:w-full lg:justify-start" onClick={() => setUi({ filtersOpen: true })} aria-label={`Filters${count ? `, ${count} active` : ""}`}>
              <Filter />
              <span className="hidden sm:inline">Filters</span>
              {count > 0 && (
                <span className="ml-0.5 flex size-5 items-center justify-center rounded-full bg-primary font-mono text-[11px] font-semibold text-primary-foreground tabular-nums shadow-[0_0_0_1.5px_var(--sheet-flat),0.5px_1px_1px_var(--btn-drop)]">
                  {count}
                </span>
              )}
            </Button>
          )}
          {showTools && (
            <Button variant="outline" size="sm" className="max-sm:h-9 max-sm:px-2.5 lg:w-full lg:justify-start" onClick={() => setUi({ importOpen: true })} aria-label="Import games">
              <Plus />
              <span className="hidden sm:inline">Import</span>
            </Button>
          )}
          <MoreMenu />
          <div className="flex items-center gap-1.5 max-sm:contents lg:mt-auto">
            <SoundToggle className="max-sm:hidden" />
            <Button variant="chit" size="icon" className="max-sm:hidden" onClick={() => setUi({ shortcutsOpen: true })} aria-label="Keyboard shortcuts">
              <HelpCircle />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
