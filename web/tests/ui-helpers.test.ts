import { describe, expect, it } from "vitest";
import { rareThreshold, splitRare } from "@/components/explorer/rare";
import { progressSummary } from "@/components/players/progress-summary";
import { describePosition } from "@/components/board/describe-position";
import { segmentLabel, toWdb, wdbPercents } from "@/components/explorer/wdb";

const row = (move: string, total: number) => ({ move, stats: { total, wins: 0, draws: 0, losses: 0 } });

describe("splitRare (arrows and table agree)", () => {
  it("rare means fewer than max(3, 1%) games", () => {
    expect(rareThreshold(19)).toBe(3);
    expect(rareThreshold(1000)).toBe(10);
    const { common, rare } = splitRare([row("Bd2", 12), row("Nbd2", 2), row("a3", 5)], 19);
    expect(common.map((r) => r.move)).toEqual(["Bd2", "a3"]);
    expect(rare.map((r) => r.move)).toEqual(["Nbd2"]);
  });
  it("never hides everything", () => {
    const rows = [row("a", 2), row("b", 1)];
    expect(splitRare(rows, 3)).toEqual({ common: rows, rare: [] });
  });
});

describe("progressSummary (L19)", () => {
  it("shows the month while chess.com archives are fetched", () => {
    const p = progressSummary({ phase: "fetching", done: 11, total: 60, added: 0, duplicates: 0 });
    expect(p.detail).toBe("Month 12 of 60");
    expect(p.pct).toBe(18);
  });
  it("shows counts once games are being saved", () => {
    expect(progressSummary({ phase: "saving", done: 5, total: 10, added: 4, duplicates: 1 }).detail).toBe("4 new · 1 duplicates · 50%");
    expect(progressSummary(null).label).toBe("Starting…");
  });
});

describe("describePosition (board name)", () => {
  it("names the last move and the side to move", () => {
    expect(describePosition([], "w")).toBe("Starting position, White to move");
    expect(describePosition(["e4"], "b")).toBe("Position after 1.e4, Black to move");
    expect(describePosition(["e4", "e5", "Nf3", "Nc6"], "w")).toBe("Position after 2...Nc6, White to move");
  });
});

describe("wdb helpers", () => {
  const stats = { total: 10, wins: 6, draws: 1, losses: 3, winRate: 0.6, drawRate: 0.1, lossRate: 0.3 };
  it("toWdb swaps wins and losses for Black", () => {
    expect(toWdb(stats, "white")).toEqual({ white: 6, draw: 1, black: 3, total: 10 });
    expect(toWdb(stats, "black")).toEqual({ white: 3, draw: 1, black: 6, total: 10 });
  });
  it("wdbPercents and segmentLabel", () => {
    expect(wdbPercents(toWdb(stats, "white")).white).toBeCloseTo(60);
    expect(segmentLabel(12)).toBeNull();
    expect(segmentLabel(15)).toBe("15");
    expect(segmentLabel(60)).toBe("60%");
  });
});
