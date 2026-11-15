"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { useMediaQuery } from "@/hooks/use-media-query";
import { linePositions } from "@/lib/position-cache";
import { svgDataUri, washPath } from "@/lib/paper";
import { useRepertoirePage } from "@/lib/repertoire/page-store";
import type { Color } from "@/lib/engine/types";
import { describePosition } from "@/components/board/describe-position";
import { BoardOverlay, type OverlayArrow, type UserArrow } from "@/components/board/BoardOverlay";
import { PlateDefs, PLATE_DRAGGING_STYLE, PLATE_PIECES } from "@/components/board/pieces";
import { PLATE_DARK, PLATE_FRAME, PLATE_LIGHT, PLATE_VARS, squareTile } from "@/components/board/plate-squares";

/** Arrow widths in board units, as on the explorer board (thicker = played more). */
const MIN_WIDTH = 9.4;
const MAX_WIDTH = 23.4;
const MAX_ARROWS = 3;

/** Highlighter wash for one square, the same marker as the explorer board's last-move / selection wash. */
function washImage(seed: string, color: string, alpha: number): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><g fill='${color}'><path transform='translate(3 3)' fill-opacity='${alpha}' d='${washPath(seed, 94, 94, 4)}'/><path transform='translate(8 2)' fill-opacity='${alpha * 0.6}' d='${washPath(`${seed}b`, 86, 96, 3)}'/></g></svg>`;
  return `url("${svgDataUri(svg)}")`;
}
const WASH = { last: "#f6e98c", sel: "#b4dde4", alpha: 0.8 } as const;
const ALL_SQUARES = Array.from({ length: 64 }, (_, i) => `${"abcdefgh"[i % 8]}${Math.floor(i / 8) + 1}`);

/** The position on the Repertoire board (page-store line up to its cursor). */
export function useBoardPosition() {
  const boardLine = useRepertoirePage((s) => s.boardLine);
  const cursor = useRepertoirePage((s) => s.cursor);
  return useMemo(() => {
    const lp = linePositions(boardLine);
    const at = Math.min(cursor, lp.sans.length);
    const fen = lp.fens[at];
    return {
      at,
      sans: lp.sans,
      fens: lp.fens,
      visible: lp.sans.slice(0, at),
      fen,
      turn: (fen.split(" ")[1] === "b" ? "b" : "w") as "w" | "b",
      lastMove: at > 0 ? lp.lastMoves[at - 1] : null,
    };
  }, [boardLine, cursor]);
}

/**
 * The Repertoire page's board: the explorer's plate (same squares, pieces, wash and ink arrows), bound to the page's own
 * line. The mat, strips, eval bar and controls around it are RepertoireBoardColumn's. Both colours can be moved, to explore or to add a line. Arrows show the moves you played in this
 * position (thicker = more games) and your locked move in green ink.
 */
export function RepertoireBoard({
  side,
  moves,
  locked,
}: {
  side: Color;
  /** Moves you played in the shown position, most games first. */
  moves: { san: string; games: number }[];
  /** Your locked move in the shown position, if any. */
  locked: string | null;
}) {
  const { fen, visible, turn, lastMove } = useBoardPosition();
  const playMove = useRepertoirePage((s) => s.playMove);
  const [selected, setSelected] = useState<string | null>(null);
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const box = useRef<HTMLDivElement>(null);
  // Stepping back over a capture: snap instead of sliding (the library pairs the pieces up wrongly).
  const [seenFen, setSeenFen] = useState({ fen, pieces: pieceCount(fen), snap: false });
  if (seenFen.fen !== fen) {
    const pieces = pieceCount(fen);
    setSeenFen({ fen, pieces, snap: pieces > seenFen.pieces });
  }

  // Keep the 32 draggable pieces out of the Tab order and the accessibility tree (the board is one labelled image).
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const fix = () => {
      el.querySelectorAll<HTMLElement>('[aria-roledescription="draggable"], [role="button"][tabindex]').forEach((n) => {
        if (n.getAttribute("tabindex") !== "-1") n.setAttribute("tabindex", "-1");
        if (n.getAttribute("aria-hidden") !== "true") n.setAttribute("aria-hidden", "true");
      });
    };
    fix();
    const mo = new MutationObserver(fix);
    mo.observe(el, { childList: true, subtree: true, attributes: true, attributeFilter: ["tabindex", "aria-hidden"] });
    return () => mo.disconnect();
  }, []);

  useEffect(() => setSelected(null), [fen]);

  const tryMove = (from: string, to: string): boolean => {
    try {
      const m = new Chess(fen).move({ from, to, promotion: "q" });
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

  const { arrows, userArrows } = useMemo(() => {
    const chess = new Chess(fen);
    const squares = (san: string) => {
      try {
        const m = chess.move(san);
        chess.undo();
        return { from: m.from, to: m.to };
      } catch {
        return null;
      }
    };
    const max = Math.max(1, ...moves.map((m) => m.games));
    const out: OverlayArrow[] = [];
    for (const m of moves) {
      if (out.length >= MAX_ARROWS) break;
      if (m.san === locked) continue;
      const sq = squares(m.san);
      if (!sq) continue;
      const rel = m.games / max;
      out.push({ ...sq, kind: "candidate", width: MIN_WIDTH + (MAX_WIDTH - MIN_WIDTH) * rel, opacity: 0.6 + 0.4 * rel });
    }
    const lockedSq = locked ? squares(locked) : null;
    const user: UserArrow[] = lockedSq ? [{ ...lockedSq, ink: "green" }] : [];
    return { arrows: out, userArrows: user };
  }, [fen, moves, locked]);

  const squareStyles = useMemo(() => {
    const washed = new Map<string, "last" | "sel">();
    if (lastMove) {
      washed.set(lastMove.from, "last");
      washed.set(lastMove.to, "last");
    }
    if (selected) washed.set(selected, "sel");
    const s: Record<string, React.CSSProperties> = {};
    for (const sq of ALL_SQUARES) {
      const tone = washed.get(sq);
      s[sq] = tone
        ? {
            backgroundImage: `${washImage(`${tone}${sq}`, WASH[tone], WASH.alpha)}, ${squareTile(sq)}`,
            backgroundBlendMode: "multiply, normal",
            backgroundSize: "100% 100%",
          }
        : { backgroundImage: squareTile(sq), backgroundSize: "100% 100%" };
    }
    return s;
  }, [lastMove, selected]);

  return (
    <div
      ref={box}
      data-testid="repertoire-board"
      className="@container relative aspect-square w-full overflow-hidden rounded-[1px]"
      style={{ "--board-light": PLATE_LIGHT, "--board-dark": PLATE_DARK, ...PLATE_VARS, boxShadow: PLATE_FRAME } as React.CSSProperties}
      role="img"
      aria-label={`Chess board. ${describePosition(visible, turn)}`}
    >
      <PlateDefs />
      <Chessboard
        options={{
          pieces: PLATE_PIECES,
          id: "repertoire-board",
          position: fen,
          boardOrientation: side,
          showNotation: false,
          allowDrawingArrows: false,
          animationDurationInMs: reduceMotion || seenFen.snap ? 0 : 160,
          squareStyles,
          lightSquareStyle: { backgroundColor: PLATE_LIGHT },
          darkSquareStyle: { backgroundColor: PLATE_DARK },
          dropSquareStyle: { boxShadow: "inset 0 0 0 3px rgba(255,252,238,0.75)" },
          draggingPieceStyle: PLATE_DRAGGING_STYLE,
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
      <BoardOverlay orientation={side} arrows={arrows} userArrows={userArrows} marks={{ targets: legalTargets }} />
    </div>
  );
}

function pieceCount(fen: string): number {
  return fen.split(" ")[0].replace(/[^a-zA-Z]/g, "").length;
}
