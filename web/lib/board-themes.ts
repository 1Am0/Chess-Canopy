import type { BoardTheme } from "@/lib/store";

export interface BoardPalette {
  light: string;
  dark: string;
}

/** Soft, Lichess/Chess.com-inspired square palettes. */
export const BOARD_THEMES: Record<BoardTheme, BoardPalette> = {
  brown: { light: "#f0d9b5", dark: "#b58863" },
  green: { light: "#ebecd0", dark: "#739552" },
  blue: { light: "#dee3e6", dark: "#8ca2ad" },
  slate: { light: "#cfd3dc", dark: "#6b7a93" },
};
