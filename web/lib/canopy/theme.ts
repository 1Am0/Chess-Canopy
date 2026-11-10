import { makeRamp, type Rgb } from "./color";

/** Every CSS variable the canopy reads (section 5.1 tokens plus the app tokens it reuses). */
export const CANOPY_VARS: readonly string[] = [
  "--canopy-branch",
  "--canopy-low",
  "--canopy-mid",
  "--canopy-high",
  "--canopy-guide",
  "--card",
  "--foreground",
  "--muted-foreground",
  "--border",
  "--arrow-preview",
  "--ring",
  "--primary",
];

export interface CanopyTheme {
  /** Card surface: text halo and node-disc separation. */
  surface: string;
  fg: string;
  muted: string;
  /** Row guides (fainter than the branches). */
  guide: string;
  branch: string;
  /** Hover / focus path (the app's amber preview). */
  hot: string;
  /** Keyboard focus ring. */
  ring: string;
  /** Current redo line (--primary). */
  line: string;
  /** 65 colors: index 0 = low (loss), 32 = mid, 64 = high (win). */
  ramp: string[];
  hazeAlpha: number;
  leafAlpha: number;
  tailAlpha: number;
  mono: string;
  sans: string;
  dark: boolean;
  /** Ground line (--border). Falls back to `guide` when absent. */
  border?: string;
}

const rgba = (c: Rgb, a: number): string => `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${+a.toFixed(3)})`;
const rgb = (c: Rgb): string => `rgb(${c[0]}, ${c[1]}, ${c[2]})`;

/** Alpha of a CSS color string like `oklch(0.9 0.03 140 / 11%)` (1 when absent). */
export function cssAlpha(css: string): number {
  const m = /\/\s*([\d.]+)(%?)\s*\)\s*$/.exec(css.trim());
  if (!m) return 1;
  const v = parseFloat(m[1]);
  if (!Number.isFinite(v)) return 1;
  return Math.min(1, Math.max(0, m[2] === "%" ? v / 100 : v));
}

/**
 * Read the tokens once per theme change. `parse` turns any CSS color (the tokens are OKLCH) into
 * sRGB; alpha is read from the string because `parse` only returns RGB.
 */
export function readCanopyTheme(
  el: Element,
  parse: (css: string) => Rgb,
  fonts: { mono: string; sans: string },
): CanopyTheme {
  const cs = getComputedStyle(el);
  const get = (name: string): string => cs.getPropertyValue(name).trim();
  const dark = el.ownerDocument?.documentElement.classList.contains("dark") ?? false;
  const borderCss = get("--border");
  const border = parse(borderCss);
  const borderA = cssAlpha(borderCss);
  return {
    surface: rgb(parse(get("--card"))),
    fg: rgb(parse(get("--foreground"))),
    muted: rgb(parse(get("--muted-foreground"))),
    guide: rgba(border, borderA * 0.7),
    border: rgba(border, borderA),
    branch: rgb(parse(get("--canopy-branch"))),
    hot: rgb(parse(get("--arrow-preview"))),
    ring: rgb(parse(get("--ring"))),
    line: rgb(parse(get("--primary"))),
    ramp: makeRamp(parse(get("--canopy-low")), parse(get("--canopy-mid")), parse(get("--canopy-high"))),
    hazeAlpha: dark ? 0.14 : 0.1,
    leafAlpha: 0.9,
    tailAlpha: dark ? 0.1 : 0.09,
    mono: fonts.mono,
    sans: fonts.sans,
    dark,
  };
}

/** 1x1 canvas probe that resolves any CSS color (oklch, color-mix, ...) to sRGB. Browser only. */
export function createColorParser(): (css: string) => Rgb {
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext("2d", { willReadFrequently: true }) as CanvasRenderingContext2D;
  const cache = new Map<string, Rgb>();
  return (css) => {
    const hit = cache.get(css);
    if (hit) return hit;
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = "#000";
    ctx.fillStyle = css;
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    const out: Rgb = [d[0], d[1], d[2]];
    cache.set(css, out);
    return out;
  };
}
