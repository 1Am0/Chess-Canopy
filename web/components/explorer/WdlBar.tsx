import type { Stats } from "@/lib/engine/types";
import { cn } from "@/lib/utils";

/** Min segment width (percent) before its label is drawn. */
const LABEL_MIN = 20;

/** Single stacked win/draw/loss bar (player perspective). */
export function WdlBar({
  stats,
  className,
  showLabels = true,
}: {
  stats: Stats;
  className?: string;
  showLabels?: boolean;
}) {
  const t = stats.total || 1;
  const segs = [
    { key: "w", n: stats.wins, cls: "bg-win", label: "Win" },
    { key: "d", n: stats.draws, cls: "bg-draw", label: "Draw" },
    { key: "l", n: stats.losses, cls: "bg-loss", label: "Loss" },
  ].map((s) => ({ ...s, p: (s.n / t) * 100 }));
  const text = segs.map((s) => `${s.label} ${Math.round(s.p)}%`).join(" · ");
  return (
    <div
      role="img"
      aria-label={text}
      className={cn(
        "flex h-5 w-full overflow-hidden rounded-full bg-muted text-[11px] leading-none font-medium text-white tabular-nums",
        className,
      )}
    >
      {segs.map((s) =>
        s.n > 0 ? (
          <div
            key={s.key}
            className={cn("flex min-w-0 items-center justify-center overflow-hidden whitespace-nowrap", s.cls)}
            style={{ width: `${s.p}%` }}
            title={`${s.label}: ${s.n} (${Math.round(s.p)}%)`}
          >
            {showLabels && s.p >= LABEL_MIN ? `${Math.round(s.p)}%` : null}
          </div>
        ) : null,
      )}
    </div>
  );
}
