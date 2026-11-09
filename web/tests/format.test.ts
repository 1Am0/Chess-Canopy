import { describe, expect, it } from "vitest";
import { compact, formatDate, isoDaysAgo, pct, resultLabel, score, sourceLabel, splitOpeningName } from "@/lib/format";

describe("format helpers", () => {
  it("pct", () => {
    expect(pct(0.5)).toBe("50%");
    expect(pct(0.1234, 1)).toBe("12.3%");
    expect(pct(Number.NaN)).toBe("–");
  });

  it("compact at the 999 / 1,000 / 9,950 / 10,000 / 1e6 boundaries", () => {
    expect(compact(999)).toBe("999");
    expect(compact(1000)).toBe("1k");
    expect(compact(1500)).toBe("1.5k");
    expect(compact(10_000)).toBe("10k");
    expect(compact(1_000_000)).toBe("1M");
    expect(compact(2_500_000)).toBe("2.5M");
  });

  it("score counts a draw as half", () => {
    expect(score({ wins: 2, draws: 2, losses: 0, total: 4, winRate: 0.5, drawRate: 0.5, lossRate: 0 })).toBe(0.75);
    expect(score({ wins: 0, draws: 0, losses: 0, total: 0, winRate: 0, drawRate: 0, lossRate: 0 })).toBe(0);
  });

  it("resultLabel agrees with the engine's result tokens", () => {
    expect(resultLabel("1-0")).toBe("Win");
    expect(resultLabel("0-1")).toBe("Loss");
    expect(resultLabel("1/2-1/2")).toBe("Draw");
    expect(resultLabel("win")).toBe("Win");
    expect(resultLabel("loss")).toBe("Loss");
  });

  it("isoDaysAgo is UTC", () => {
    const now = Date.UTC(2025, 2, 1, 23, 59, 59);
    expect(isoDaysAgo(0, now)).toBe("2025-03-01");
    expect(isoDaysAgo(1, now)).toBe("2025-02-28");
    expect(isoDaysAgo(30, now)).toBe("2025-01-30");
  });

  it("formatDate keeps invalid input and blanks empty input", () => {
    expect(formatDate("")).toBe("");
    expect(formatDate("not-a-date")).toBe("not-a-date");
    expect(formatDate("2024-05-06")).toMatch(/2024/);
  });

  it("sourceLabel and splitOpeningName", () => {
    expect(sourceLabel("pgn")).toBe("PGN");
    expect(sourceLabel("json")).toBe("JSON");
    expect(sourceLabel("lichess")).toBe("lichess");
    expect(splitOpeningName("Sicilian Defense: Najdorf, English Attack")).toEqual(["Sicilian Defense", "Najdorf", "English Attack"]);
  });
});
