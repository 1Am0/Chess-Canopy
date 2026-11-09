"use client";

import { useEffect, useMemo, useState } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { useExplorerStore } from "@/lib/store";
import { usePosition } from "@/hooks/use-position";
import { BOARD_THEMES } from "@/lib/board-themes";

const MAX_ARROWS = 3;
const MIN_ARROW_SHARE = 0.1;
const CANDIDATE_RGB = "21,101,192";
const HOVER_COLOR = "rgba(245,124,0,1)";

const overlay = (rgba: string) => `linear-gradient(${rgba}, ${rgba})`;

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
    if (!selected) return [] as { to: string; capture: boolean }[];
    try {
      return new Chess(fen)
        .moves({ square: selected as never, verbose: true })
        .map((m) => ({ to: m.to, capture: m.flags.includes("c") || m.flags.includes("e") }));
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
    if (hoverMove) {
      const a = toArrow(hoverMove);
      return a ? [{ ...a, color: HOVER_COLOR }] : [];
    }
    const total = result.next.reduce((n, m) => n + m.stats.total, 0) || 1;
    const max = result.next[0]?.stats.total || 1;
    const picked = result.next.filter((n, i) => i === 0 || n.stats.total / total >= MIN_ARROW_SHARE).slice(0, MAX_ARROWS);
    type A = { startSquare: string; endSquare: string; color: string; idx: number };
    const vec = (a: { startSquare: string; endSquare: string }) => [
      a.endSquare.charCodeAt(0) - a.startSquare.charCodeAt(0),
      a.endSquare.charCodeAt(1) - a.startSquare.charCodeAt(1),
    ];
    const collinear = (a: A, b: A) => {
      if (a.startSquare !== b.startSquare) return false;
      const [ax, ay] = vec(a);
      const [bx, by] = vec(b);
      return ax * by - ay * bx === 0 && ax * bx + ay * by > 0;
    };
    const len = (a: A) => Math.max(...vec(a).map(Math.abs));
    let out: A[] = [];
    picked.forEach((n, idx) => {
      const a = toArrow(n.move);
      if (!a) return;
      let alpha = 0.4 + 0.5 * (n.stats.total / max);
      // Shared start square (non-collinear): fade the less frequent one so both stay readable.
      if (out.some((o) => o.startSquare === a.startSquare)) alpha *= 0.6;
      const cur: A = { ...a, color: `rgba(${CANDIDATE_RGB},${alpha.toFixed(2)})`, idx };
      // Collinear arrows from one square overlap into a single long line: keep only the nearer,
      // unless the farther one is the top move.
      const clash = out.find((o) => collinear(o, cur));
      if (clash) {
        if (len(cur) < len(clash) && clash.idx !== 0) out = out.filter((o) => o !== clash);
        else if (len(cur) < len(clash) || cur.idx !== 0) return;
        else out = out.filter((o) => o !== clash);
      }
      out.push(cur);
    });
    return out.map(({ startSquare, endSquare, color }) => ({ startSquare, endSquare, color }));
  }, [result, key, fen, hoverMove]);

  const squareStyles = useMemo(() => {
    const layers: Record<string, string[]> = {};
    const add = (sq: string, img: string) => (layers[sq] ||= []).push(img);
    // Layers are painted first-listed on top; build in top-to-bottom order.
    for (const t of legalTargets) {
      add(
        t.to,
        t.capture
          ? "radial-gradient(circle, transparent 62%, rgba(20,20,20,0.3) 64%)"
          : "radial-gradient(circle, rgba(20,20,20,0.28) 21%, transparent 23%)",
      );
    }
    if (selected) add(selected, overlay("rgba(59,130,246,0.5)"));
    if (lastMove) {
      for (const sq of [lastMove.from, lastMove.to]) {
        // a1 is dark: file+rank parity even => dark square.
        const dark = (sq.charCodeAt(0) - 97 + Number(sq[1]) - 1) % 2 === 0;
        add(sq, overlay(dark ? "rgba(255,224,0,0.68)" : "rgba(255,235,59,0.45)"));
      }
    }
    const s: Record<string, React.CSSProperties> = {};
    for (const [sq, imgs] of Object.entries(layers)) s[sq] = { backgroundImage: imgs.join(", ") };
    return s;
  }, [lastMove, selected, legalTargets]);

  const theme = BOARD_THEMES[boardTheme];

  return (
    <div
      className="@container aspect-square w-full overflow-hidden rounded-md shadow-md ring-1 ring-black/15"
      aria-label="Chess board"
    >
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
            colors: {
              default: "rgba(22,163,74,0.85)",
              shift: "rgba(220,38,38,0.85)",
              ctrl: "rgba(245,124,0,0.85)",
              alt: "rgba(21,101,192,0.85)",
              meta: "rgba(147,51,234,0.85)",
            },
            color: "rgba(22,163,74,0.85)",
            secondaryColor: "rgba(220,38,38,0.85)",
            tertiaryColor: "rgba(245,124,0,0.85)",
            arrowLengthReducerDenominator: 8,
            sameTargetArrowLengthReducerDenominator: 4,
            arrowWidthDenominator: 5.5,
            activeArrowWidthMultiplier: 0.9,
            opacity: 1,
            activeOpacity: 0.6,
            arrowStartOffset: 0.15,
          },
          squareStyles,
          lightSquareStyle: { backgroundColor: theme.light },
          darkSquareStyle: { backgroundColor: theme.dark },
          // Coordinates take the opposite square color.
          lightSquareNotationStyle: { color: theme.dark },
          darkSquareNotationStyle: { color: theme.light },
          alphaNotationStyle: { fontSize: "clamp(10px, 2.9cqw, 13px)", fontWeight: 700, bottom: 2, right: 4, userSelect: "none" },
          numericNotationStyle: { fontSize: "clamp(10px, 2.9cqw, 13px)", fontWeight: 700, top: 2, left: 3, userSelect: "none" },
          dropSquareStyle: { boxShadow: "inset 0 0 0 3px rgba(255,255,255,0.7)" },
          draggingPieceStyle: { transform: "scale(1.1)" },
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
