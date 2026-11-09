/** "Position after 6...Bb4+, White to move" (used for the board's accessible name). */
export function describePosition(visible: string[], turn: "w" | "b"): string {
  const toMove = turn === "w" ? "White" : "Black";
  if (!visible.length) return `Starting position, ${toMove} to move`;
  const n = visible.length;
  const num = Math.ceil(n / 2);
  return `Position after ${num}${n % 2 === 1 ? "." : "..."}${visible[n - 1]}, ${toMove} to move`;
}
