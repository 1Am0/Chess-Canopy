"use client";

import { useId, useMemo } from "react";
import { createRng, n2, tapePath } from "@/lib/paper";
import { cn } from "@/lib/utils";

/**
 * A strip of masking / washi tape: translucent, torn zig-zag ends from the seeded generator,
 * faint lengthwise fibre, a soft highlight band and a thin shadow. Multiplies with what is
 * underneath in light mode (so the sheet shows through, tinted); dark mode uses a lighter,
 * lower-alpha tape without multiply (token --tape-blend).
 *
 * Position it with `className` (it is `absolute`); keep `angle` within -4..+4 degrees.
 * Decorative: aria-hidden, no pointer events, hidden in forced-colors mode.
 */
export function Tape({
  variant = "ochre",
  length = 96,
  height = 22,
  angle = -2,
  seed = 1,
  label,
  className,
  style,
}: {
  variant?: "ochre" | "sage";
  length?: number;
  height?: number;
  angle?: number;
  seed?: number | string;
  /** Short handwritten label on the tape (Caveat, pencil). Never data. */
  label?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const uid = useId().replace(/:/g, "");
  const clamped = Math.max(-4, Math.min(4, angle));
  const { body, fibres } = useMemo(() => {
    const rng = createRng(`fibre-${seed}`);
    const lines: { d: string; light: boolean }[] = [];
    const count = Math.max(5, Math.round(height / 3.2));
    for (let i = 0; i < count; i++) {
      const y = rng.range(1.5, height - 1.5);
      const x1 = rng.range(0, length * 0.2);
      const x2 = rng.range(length * 0.7, length);
      const dy = rng.range(-0.5, 0.5);
      lines.push({ d: `M${n2(x1)} ${n2(y)}L${n2(x2)} ${n2(y + dy)}`, light: i % 2 === 0 });
    }
    return { body: tapePath(seed, length, height), fibres: lines };
  }, [seed, length, height]);

  const fill = variant === "sage" ? "var(--tape-sage)" : "var(--tape-ochre)";

  return (
    <span
      aria-hidden
      className={cn("paper-deco pointer-events-none absolute z-20 block", className)}
      style={{
        width: length,
        height,
        transform: `rotate(${clamped}deg)`,
        mixBlendMode: "var(--tape-blend)" as React.CSSProperties["mixBlendMode"],
        ...style,
      }}
    >
      <svg
        width={length}
        height={height}
        viewBox={`0 0 ${length} ${height}`}
        className="block overflow-visible"
        style={{ filter: "drop-shadow(0 0.6px 0.6px color-mix(in oklab, var(--shadow-ink) 38%, transparent))" }}
      >
        <defs>
          <clipPath id={`${uid}-c`}>
            <path d={body} />
          </clipPath>
        </defs>
        <path d={body} style={{ fill }} />
        <g clipPath={`url(#${uid}-c)`}>
          {/* soft highlight band, a third of the way down, like light on a glossy-matt film */}
          <rect x="0" y={n2(height * 0.2)} width={length} height={n2(height * 0.2)} fill="oklch(1 0 0 / 0.26)" />
          {/* lengthwise fibre of the crepe paper backing */}
          {fibres.map((f, i) => (
            <path
              key={i}
              d={f.d}
              fill="none"
              strokeWidth="0.5"
              style={{ stroke: f.light ? "oklch(1 0 0 / 0.34)" : "oklch(0.45 0.05 80 / 0.16)" }}
            />
          ))}
          {/* the long edges are a hair darker where the film is thicker */}
          <rect x="0" y="0" width={length} height="0.8" fill="oklch(0.4 0.05 80 / 0.16)" />
          <rect x="0" y={n2(height - 0.8)} width={length} height="0.8" fill="oklch(0.4 0.05 80 / 0.16)" />
        </g>
      </svg>
      {label ? (
        <span className="absolute inset-0 flex items-center justify-center px-3 font-hand text-[17px] leading-none font-medium whitespace-nowrap text-pencil">
          {label}
        </span>
      ) : null}
    </span>
  );
}
