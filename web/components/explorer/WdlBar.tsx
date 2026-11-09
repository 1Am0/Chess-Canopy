import type { Stats } from "@/lib/engine/types";
import { cn } from "@/lib/utils";

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
  ];
  const text = segs.map((s) => `${s.label} ${Math.round((s.n / t) * 100)}%`).join(", ");
  return (
    <div
      role="img"
      aria-label={text}
      className={cn("flex h-5 w-full overflow-hidden rounded-[5px] bg-muted text-[11px] font-medium text-white tabular-nums", className)}
    >
      {segs.map((s) =>
        s.n > 0 ? (
          <div
            key={s.key}
            className={cn("flex items-center justify-center overflow-hidden", s.cls)}
            style={{ width: `${(s.n / t) * 100}%` }}
            title={`${s.label}: ${s.n} (${Math.round((s.n / t) * 100)}%)`}
          >
            {showLabels && (s.n / t) * 100 >= 9 ? `${Math.round((s.n / t) * 100)}%` : null}
          </div>
        ) : null,
      )}
    </div>
  );
}
