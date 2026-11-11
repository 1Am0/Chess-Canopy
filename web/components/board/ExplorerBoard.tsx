"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { useExplorerStore } from "@/lib/store";
import { usePosition } from "@/hooks/use-position";
import { useMediaQuery } from "@/hooks/use-media-query";
import { splitRare } from "@/components/explorer/rare";
import { describePosition } from "@/components/board/describe-position";
import { BoardOverlay, type OverlayArrow, type UserArrow, type UserInk } from "@/components/board/BoardOverlay";
import { svgDataUri, washPath } from "@/lib/paper";
import { PlateDefs, PLATE_DRAGGING_STYLE, PLATE_PIECES } from "@/components/board/pieces";
import { PLATE_DARK, PLATE_FRAME, PLATE_LIGHT, PLATE_VARS, squareTile } from "@/components/board/plate-squares";

const MAX_ARROWS = 3;
const MIN_ARROW_SHARE = 0.1;
const MIN_WIDTH = 9.4; // 6/64 of a square (100 units)
const MAX_WIDTH = 23.4; // 15/64 of a square
const HOVER_WIDTH = 20;

/**
 * Muted inks for arrows the user draws (right-drag, plus Shift / Ctrl / Alt / Cmd). The strings only matter while the
 * stroke is being dragged (the library paints that preview); once committed, BoardOverlay redraws the arrow as ink.
 */
const USER_INKS: Record<string, UserInk> = {
  "#4d7a55": "green",
  "#a8503f": "red",
  "#b88a2e": "ochre",
  "#4a77a0": "blue",
  "#5b574d": "graphite",
};
const INK_STRINGS = { default: "#4d7a55", shift: "#a8503f", ctrl: "#b88a2e", alt: "#4a77a0", meta: "#5b574d" };

/**
 * A highlighter wash for one square: two uneven passes of a marker. It is a background image of the square (so the
 * piece stays crisp on top); in light mode it multiplies with the square colour like ink soaking into paper.
 */
function washImage(seed: string, color: string, alpha: number): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><g fill='${color}'><path transform='translate(3 3)' fill-opacity='${alpha}' d='${washPath(seed, 94, 94, 4)}'/><path transform='translate(8 2)' fill-opacity='${alpha * 0.6}' d='${washPath(`${seed}b`, 86, 96, 3)}'/></g></svg>`;
  return `url("${svgDataUri(svg)}")`;
}
/** Highlighter inks; they multiply with the printed square like marker soaking into paper. */
const WASH = { last: "#f6e98c", sel: "#b4dde4", alpha: 0.8 } as const;

const ALL_SQUARES = Array.from({ length: 64 }, (_, i) => `${"abcdefgh"[i % 8]}${Math.floor(i / 8) + 1}`);

export function ExplorerBoard() {
  const { fen, visible, lastMove, key, turn } = usePosition();
  // Stepping back over a capture brings a piece back, and the library's slide animation pairs the pieces up wrongly
  // (two of them fly across the board for a moment). More pieces than before = a capture was undone: snap, don't slide.
  const [seenFen, setSeenFen] = useState({ fen, pieces: pieceCount(fen), snap: false });
  if (seenFen.fen !== fen) {
    const pieces = pieceCount(fen);
    setSeenFen({ fen, pieces, snap: pieces > seenFen.pieces });
  }
  const orientation = useExplorerStore((s) => s.orientation);
  const result = useExplorerStore((s) => s.result);
  const hoverMove = useExplorerStore((s) => s.hoverMove);
  const playMove = useExplorerStore((s) => s.playMove);
  const [selected, setSelected] = useState<string | null>(null);
  const [userArrows, setUserArrows] = useState<UserArrow[]>([]);
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const box = useRef<HTMLDivElement>(null);

  // react-chessboard (dnd-kit) renders every piece as an unnamed, focusable "draggable"
  // button. Moves are played from the table, so keep the 32 pieces out of the Tab order
  // and the accessibility tree (the board itself is exposed as one labelled image).
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

  // Clear click-selection whenever the position changes.
  useEffect(() => setSelected(null), [key]);

  const tryMove = (from: string, to: string): boolean => {
    try {
      const chess = new Chess(fen);
      const options = chess.moves({ verbose: true }).filter((o) => o.from === from && o.to === to);
      // A promotion: use the piece your games actually promoted to here, else a queen.
      let promotion = "q";
      if (options.length > 1 && result) {
        const played = result.next.find((n) => options.some((o) => o.san === n.move));
        const hit = played && options.find((o) => o.san === played.move);
        if (hit?.promotion) promotion = hit.promotion;
      }
      const m = chess.move({ from, to, promotion });
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

  const arrows = useMemo((): OverlayArrow[] => {
    if (!result || result.path.join(" ") !== key) return [];
    const chess = new Chess(fen);
    const toSquares = (san: string) => {
      try {
        const m = chess.move(san);
        chess.undo();
        return { from: m.from, to: m.to };
      } catch {
        return null;
      }
    };
    const total = result.next.reduce((n, m) => n + m.stats.total, 0) || 1;
    if (hoverMove) {
      const sq = toSquares(hoverMove);
      if (!sq) return [];
      return [{ ...sq, kind: "hover", width: HOVER_WIDTH, opacity: 1 }];
    }
    const max = result.next[0]?.stats.total || 1;
    // Only moves the table lists as common get an arrow.
    const common = splitRare(result.next, result.stats.total).common;
    const picked = common.filter((n, i) => i === 0 || n.stats.total / total >= MIN_ARROW_SHARE).slice(0, MAX_ARROWS);
    type A = OverlayArrow & { idx: number };
    const vec = (a: { from: string; to: string }) => [a.to.charCodeAt(0) - a.from.charCodeAt(0), a.to.charCodeAt(1) - a.from.charCodeAt(1)];
    const collinear = (a: A, b: A) => {
      if (a.from !== b.from) return false;
      const [ax, ay] = vec(a);
      const [bx, by] = vec(b);
      return ax * by - ay * bx === 0 && ax * bx + ay * by > 0;
    };
    const len = (a: A) => Math.max(...vec(a).map(Math.abs));
    let out: A[] = [];
    picked.forEach((n, idx) => {
      const sq = toSquares(n.move);
      if (!sq) return;
      const rel = n.stats.total / max;
      let opacity = 0.6 + 0.4 * rel;
      // Shared start square (non-collinear): fade the less frequent one so both stay readable.
      if (out.some((o) => o.from === sq.from)) opacity = Math.max(0.6, opacity * 0.8);
      const cur: A = {
        ...sq,
        kind: "candidate",
        width: MIN_WIDTH + (MAX_WIDTH - MIN_WIDTH) * rel,
        opacity,
        idx,
      };
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
    return out.map((o) => ({ from: o.from, to: o.to, kind: o.kind, width: o.width, opacity: o.opacity }));
  }, [result, key, fen, hoverMove]);

  // Drag momentum: while a piece is held, its tilt follows a damped spring driven by the pointer's sideways speed,
  // so its base trails behind the direction of travel like air drag, overshoots a little, and settles when you stop.
  useEffect(() => {
    const el = box.current;
    if (!el || reduceMotion) return;
    // The held piece is the board's drag clone; its transform reads --drag-rot, so the var is set on that one element
    // (setting it on <html> re-styled the whole page every frame, which is what made dragging laggy).
    let clone: HTMLElement | null = null;
    const findClone = () => el.querySelector<HTMLElement>('[data-piece][style*="drag-rot"]') ?? document.querySelector<HTMLElement>('[data-piece][style*="drag-rot"]');
    let down = false;
    let lastX = 0;
    let vx = 0;
    let ang = 0;
    let vel = 0;
    let raf = 0;
    const tick = () => {
      const target = Math.max(-24, Math.min(24, vx * 1.2));
      vel = (vel + (target - ang) * 0.16) * 0.8;
      ang += vel;
      vx *= 0.85;
      if (!clone || !clone.isConnected) clone = findClone();
      clone?.style.setProperty("--drag-rot", `${ang.toFixed(2)}deg`);
      if (down || Math.abs(ang) > 0.05 || Math.abs(vel) > 0.05) raf = requestAnimationFrame(tick);
      else clone = null;
    };
    const onDown = (e: PointerEvent) => {
      if (!(e.target as Element | null)?.closest("[data-piece]")) return;
      down = true;
      lastX = e.clientX;
      vx = 0;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(tick);
    };
    const onMove = (e: PointerEvent) => {
      if (!down) return;
      vx = vx * 0.4 + (e.clientX - lastX) * 0.6;
      lastX = e.clientX;
    };
    const onUp = () => {
      down = false;
    };
    el.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [reduceMotion]);

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
      data-testid="board"
      className="@container relative aspect-square w-full overflow-hidden rounded-[1px]"
      style={{ "--board-light": PLATE_LIGHT, "--board-dark": PLATE_DARK, ...PLATE_VARS, boxShadow: PLATE_FRAME } as React.CSSProperties}
      role="img"
      aria-label={`Chess board. ${describePosition(visible, turn)}`}
    >
      <PlateDefs />
      <Chessboard
        options={{
          pieces: PLATE_PIECES,
          id: "explorer-board",
          position: fen,
          boardOrientation: orientation,
          showNotation: false,
          allowDrawingArrows: true,
          clearArrowsOnPositionChange: true,
          animationDurationInMs: reduceMotion || seenFen.snap ? 0 : 160,
          onArrowsChange: ({ arrows: drawn }) =>
            setUserArrows((prev) => {
              const next = drawn.map((a) => ({ from: a.startSquare, to: a.endSquare, ink: USER_INKS[a.color] ?? "green" }));
              return prev.length === 0 && next.length === 0 ? prev : next;
            }),
          arrowOptions: {
            colors: INK_STRINGS,
            color: INK_STRINGS.default,
            secondaryColor: INK_STRINGS.shift,
            tertiaryColor: INK_STRINGS.ctrl,
            arrowLengthReducerDenominator: 8,
            sameTargetArrowLengthReducerDenominator: 4,
            arrowWidthDenominator: 5.5,
            activeArrowWidthMultiplier: 0.9,
            // Committed arrows are redrawn as ink by BoardOverlay; the library only paints the stroke being dragged.
            opacity: 0,
            activeOpacity: 0.45,
            arrowStartOffset: 0.15,
          },
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
      <BoardOverlay orientation={orientation} arrows={arrows} userArrows={userArrows} marks={{ targets: legalTargets }} />
    </div>
  );
}

/** Number of pieces on the board in a FEN. */
function pieceCount(fen: string): number {
  return fen.split(" ")[0].replace(/[^a-zA-Z]/g, "").length;
}
