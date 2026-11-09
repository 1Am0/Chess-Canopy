import type { BoardTheme } from "@/lib/store";

export interface BoardPalette {
  light: string;
  dark: string;
}

/**
 * Square palettes harmonized with the Canopy brand (see docs/palette.md).
 * Default theme is "green"; its values are mirrored by `--board-light` /
 * `--board-dark` in app/globals.css. Keep the two in sync.
 */
export const BOARD_THEMES: Record<BoardTheme, BoardPalette> = {
  green: { light: "#ecefd6", dark: "#6e9358" },
  brown: { light: "#f0dbb8", dark: "#b3865c" },
  blue: { light: "#dfe6ea", dark: "#7f9aa8" },
  slate: { light: "#d3d7de", dark: "#667690" },
};
