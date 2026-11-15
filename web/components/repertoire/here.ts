"use client";

import { useRepertoirePage } from "@/lib/repertoire/page-store";
import { useRepertoireData } from "@/components/repertoire/repertoire-data";
import { useBoardPosition } from "@/components/repertoire/RepertoireBoard";
import { epdOf } from "@/components/repertoire/format";

/**
 * What the report and the saved moves say about the position on the board: whose move it is, the report position and
 * saved move there (your move only), and, when the board is on the opponent's move, the position before your last move.
 */
export function useHere() {
  const { side, pointsByEpd, entriesByEpd } = useRepertoireData();
  const pos = useBoardPosition();
  const yourTurn = pos.turn === (side === "white" ? "w" : "b");
  const epd = epdOf(pos.fen);
  const point = yourTurn ? pointsByEpd.get(epd) : undefined;
  const entry = yourTurn ? entriesByEpd.get(epd) : undefined;
  const locked = point?.locked ?? entry?.san ?? null;
  // The position before the last move, when that move was yours (the board is now on the opponent's turn).
  const prev =
    !yourTurn && pos.at > 0
      ? { epd: epdOf(pos.fens[pos.at - 1]), fen: pos.fens[pos.at - 1], san: pos.sans[pos.at - 1], line: pos.sans.slice(0, pos.at - 1) }
      : null;
  const prevEntry = prev ? entriesByEpd.get(prev.epd) : undefined;
  return { ...pos, side, yourTurn, epd, point, entry, locked, prev, prevEntry };
}

/** Back to the selected report position or saved line (or the start when nothing is selected). */
export function useBackToSelected() {
  const { pointsByEpd, entriesByEpd } = useRepertoireData();
  const selectedEpd = useRepertoirePage((s) => s.selectedEpd);
  const select = useRepertoirePage((s) => s.select);
  return () => {
    const line = selectedEpd ? (pointsByEpd.get(selectedEpd)?.line ?? entriesByEpd.get(selectedEpd)?.line) : null;
    select(selectedEpd, line ?? []);
  };
}
