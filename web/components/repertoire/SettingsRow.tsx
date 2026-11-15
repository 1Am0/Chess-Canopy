"use client";

import { useRepertoirePage } from "@/lib/repertoire/page-store";
import { MAX_MOVE_CHOICES, PERIOD_CHOICES } from "@/lib/repertoire/types";
import { CountedOption } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useRepertoireData } from "@/components/repertoire/repertoire-data";
import { capitalize } from "@/components/repertoire/format";

/** FilterRow's text-link button ("+ Add filter"). */
const LINK_BTN = "h-7 shrink-0 px-2 text-sm font-medium text-ink underline decoration-ink/40 underline-offset-[3px] hover:bg-transparent hover:decoration-ink";

/** Time control, period and depth: the controls of the "Change" popover. */
function SettingsControls() {
  const { report } = useRepertoireData();
  const setTimeControl = useRepertoirePage((s) => s.setTimeControl);
  const maxMove = useRepertoirePage((s) => s.maxMove);
  const setMaxMove = useRepertoirePage((s) => s.setMaxMove);
  const periodDays = useRepertoirePage((s) => s.periodDays);
  const setPeriodDays = useRepertoirePage((s) => s.setPeriodDays);
  const allGames = (report?.timeControls ?? []).reduce((n, t) => n + t.games, 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <h2 className="label-caps text-[11px] text-pencil">Time control</h2>
        <div role="group" aria-label="Time control" className="flex flex-wrap gap-1.5">
          {report ? (
            <>
              {report.timeControls.map((t) => (
                <Button
                  key={t.timeControl}
                  variant="outline"
                  size="sm"
                  aria-pressed={report.timeControl === t.timeControl}
                  onClick={() => setTimeControl(t.timeControl)}
                  className="max-sm:h-10"
                >
                  <CountedOption label={capitalize(t.timeControl)} count={t.games} />
                </Button>
              ))}
              <Button variant="outline" size="sm" aria-pressed={report.timeControl === null} onClick={() => setTimeControl(null)} className="max-sm:h-10">
                <CountedOption label="All" count={allGames} />
              </Button>
            </>
          ) : (
            <Skeleton className="h-8 w-full" />
          )}
        </div>
      </div>
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2">
        <h2 className="label-caps text-[11px] text-pencil" id="period-label">
          Period
        </h2>
        <Select value={periodDays === null ? "all" : String(periodDays)} onValueChange={(v) => setPeriodDays(v === "all" ? null : Number(v))}>
          <SelectTrigger aria-labelledby="period-label" className="h-8 w-full max-sm:h-10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_CHOICES.map((c) => (
              <SelectItem key={c.label} value={c.days === null ? "all" : String(c.days)}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <h2 className="label-caps text-[11px] text-pencil" id="depth-label">
          Depth
        </h2>
        <Select value={String(maxMove)} onValueChange={(v) => setMaxMove(Number(v))}>
          <SelectTrigger aria-labelledby="depth-label" className="h-8 w-full max-sm:h-10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MAX_MOVE_CHOICES.map((n) => (
              <SelectItem key={n} value={String(n)}>
                Up to move {n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

/**
 * In FilterRow's place, fixed 32px: the report's settings in one line ("Blitz · Last year · up to move 12 · 46 games")
 * and a "Change" link that opens the time control, period and depth controls.
 */
export function SettingsRow() {
  const { report, stale } = useRepertoireData();
  const timeControl = useRepertoirePage((s) => s.timeControl);
  const maxMove = useRepertoirePage((s) => s.maxMove);
  const periodDays = useRepertoirePage((s) => s.periodDays);
  const shown = stale ? null : report;

  // "auto" is only known once the report says which time control it used.
  const tc = shown ? shown.timeControl : timeControl;
  const parts: string[] = [];
  if (tc !== "auto") parts.push(tc === null ? "All games" : capitalize(tc));
  parts.push(PERIOD_CHOICES.find((c) => c.days === periodDays)?.label ?? "All time");
  parts.push(`up to move ${maxMove}`);
  if (shown) parts.push(`${shown.games.toLocaleString("en-US")} ${shown.games === 1 ? "game" : "games"}`);
  const text = parts.join(" · ");

  return (
    <div data-slot="settings-row" className="flex h-8 min-w-0 shrink-0 items-center gap-2">
      <p className="flex min-w-0 flex-1 items-center gap-2 truncate text-sm text-pencil" data-testid="games-analysed" title={text}>
        <span className="truncate">{text}</span>
        {!shown && <Skeleton className="h-4 w-16 shrink-0" />}
      </p>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" aria-label="Change the time control, period and depth" className={LINK_BTN}>
            <span aria-hidden>Change</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 max-w-[calc(100vw-1.5rem)]">
          <SettingsControls />
        </PopoverContent>
      </Popover>
    </div>
  );
}
