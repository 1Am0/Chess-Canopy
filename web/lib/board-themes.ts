import type { BoardTheme } from "@/lib/store";

export interface BoardPalette {
  light: string;
  dark: string;
}

/**
 * Board square colors (see docs/palette.md). The values are mirrored by
 * `--board-light` / `--board-dark` in app/globals.css. Keep the two in sync.
 */
export const BOARD_THEMES: Record<BoardTheme, BoardPalette> = {
  lichen: { light: "#e8e4d4", dark: "#8fa08a" },
};
