import { describe, expect, it } from "vitest";
import { bestCandidate } from "@/components/explorer/best-move";

const mv = (move: string, total: number, wins: number, draws = 0) => ({ move, stats: { total, wins, draws, losses: total - wins - draws } });

describe("bestCandidate (the margin note)", () => {
  it("picks the best score for the player among common moves", () => {
    const b = bestCandidate([mv("e4", 20, 12), mv("d4", 30, 12), mv("c4", 10, 5)], 60);
    expect(b).toEqual({ move: "e4", score: 0.6, games: 20 });
  });

  it("ignores rare moves, even with a perfect score", () => {
    const b = bestCandidate([mv("e4", 40, 20), mv("d4", 30, 12), mv("a3", 1, 1)], 71);
    expect(b?.move).toBe("e4");
  });

  it("claims nothing with a single candidate or a tie", () => {
    expect(bestCandidate([mv("e4", 20, 12)], 20)).toBeNull();
    expect(bestCandidate([mv("e4", 20, 10), mv("d4", 20, 10)], 40)).toBeNull();
    expect(bestCandidate([], 0)).toBeNull();
  });
});
