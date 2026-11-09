"use client";

import { useEffect, useMemo, useState } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { useExplorerStore, type BoardTheme } from "@/lib/store";
import { usePosition } from "@/hooks/use-position";
import { score } from "@/lib/format";

const THEMES: Record<BoardTheme, { light: string; dark: string }> = {
  green: { light: "#eeeed2", dark: "#769656" },
  brown: { light: "#f0d9b5", dark: "#b58863" },
  blue: { light: "#dee3e6", dark: "#8ca2ad" },
  slate: { light: "#c8ccd4", dark: "#5d6b82" },
};

function rgba(rgb: string, a: number) {
  return `rgba(${rgb},${a.toFixed(2)})`;
}

export function ExplorerBoard() {
  const { fen, visible, lastMove, key } = usePosition();
  const orientation = useExplorerStore((s) => s.orientation);
  const result = useExplorerStore((s) => s.result);
  const hoverMove = useExplorerStore((s) => s.hoverMove);
  const boardTheme = useExplorerStore((s) => s.boardTheme);
  const playMove = useExplorerStore((s) => s.playMove);
  const [selected, setSelected] = useState<string | null>(null);

  // Clear click-selection whenever the position changes.
  useEffect(() => setSelected(null), [key]);

  const tryMove = (from: string, to: string): boolean => {
    try {
      const chess = new Chess(fen);
      const m = chess.move({ from, to, promotion: "q" });
      playMove(m.san);
      setSelected(null);
      return true;
    } catch {
      return false;
    }
  };

  const legalTargets = useMemo(() => {
    if (!selected) return [] as string[];
    try {
      return new Chess(fen).moves({ square: selected as never, verbose: true }).map((m) => m.to);
    } catch {
      return [];
    }
  }, [selected, fen]);

  const arrows = useMemo(() => {
    if (!result || result.path.join(" ") !== key) return [];
    const chess = new Chess(fen);
    const toArrow = (san: string) => {
      try {
        const m = chess.move(san);
        chess.undo();
        return { startSquare: m.from, endSquare: m.to };
      } catch {
        return null;
      }
    };
    const top = result.next.slice(0, 3);
    const max = top[0]?.stats.total || 1;
    const out: { startSquare: string; endSquare: string; color: string }[] = [];
    for (const n of top) {
      if (n.move === hoverMove) continue;
      const a = toArrow(n.move);
      if (!a) continue;
      const sc = score(n.stats);
      const rgb = sc >= 0.55 ? "34,170,94" : sc <= 0.45 ? "226,75,75" : "230,160,30";
      out.push({ ...a, color: rgba(rgb, 0.3 + 0.5 * (n.stats.total / max)) });
    }
    if (hoverMove) {
      const a = toArrow(hoverMove);
      if (a) out.push({ ...a, color: "rgba(59,130,246,0.92)" });
    }
    return out;
  }, [result, key, fen, hoverMove]);

  const squareStyles = useMemo(() => {
    const s: Record<string, React.CSSProperties> = {};
    if (lastMove) {
      s[lastMove.from] = { backgroundColor: "rgba(255,213,0,0.38)" };
      s[lastMove.to] = { backgroundColor: "rgba(255,213,0,0.5)" };
    }
    if (selected) s[selected] = { ...s[selected], backgroundColor: "rgba(59,130,246,0.55)" };
    for (const t of legalTargets) {
      s[t] = { ...s[t], backgroundImage: "radial-gradient(circle, rgba(0,0,0,0.28) 22%, transparent 24%)" };
    }
    return s;
  }, [lastMove, selected, legalTargets]);

  const theme = THEMES[boardTheme];

  return (
    <div className="aspect-square w-full overflow-hidden rounded-lg shadow-sm ring-1 ring-border" aria-label="Chess board">
      <Chessboard
        options={{
          id: "explorer-board",
          position: fen,
          boardOrientation: orientation,
          showNotation: true,
          allowDrawingArrows: true,
          clearArrowsOnPositionChange: true,
          animationDurationInMs: 150,
          arrows,
          arrowOptions: {
            colors: { default: "#f59e0b", shift: "#22c55e", ctrl: "#ef4444", alt: "#3b82f6", meta: "#a855f7" },
            color: "#f59e0b",
            secondaryColor: "#22c55e",
            tertiaryColor: "#ef4444",
            arrowLengthReducerDenominator: 8,
            sameTargetArrowLengthReducerDenominator: 4,
            arrowWidthDenominator: 5,
            activeArrowWidthMultiplier: 0.9,
            opacity: 1,
            activeOpacity: 0.5,
            arrowStartOffset: 0.15,
          },
          squareStyles,
          lightSquareStyle: { backgroundColor: theme.light },
          darkSquareStyle: { backgroundColor: theme.dark },
          onPieceDrop: ({ sourceSquare, targetSquare }) => (targetSquare ? tryMove(sourceSquare, targetSquare) : false),
          onSquareClick: ({ square }) => {
            if (selected && selected !== square && tryMove(selected, square)) return;
            try {
              const chess = new Chess(fen);
              const piece = chess.get(square as never);
              setSelected(piece && piece.color === chess.turn() && selected !== square ? square : null);
            } catch {
              setSelected(null);
            }
          },
        }}
      />
      <span className="sr-only" aria-live="polite">
        {visible.length ? `Position after ${visible[visible.length - 1]}` : "Starting position"}
      </span>
    </div>
  );
}
