import { beforeEach, describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import {
  activeFilterCount,
  isResultFresh,
  migratePersisted,
  selectionFilters,
  useExplorerStore,
} from "@/lib/store";
import { canonicalLine, linePositions, resetPositionCache } from "@/lib/position-cache";
import { autoSide, parseLineParam } from "@/hooks/use-explorer-sync";
import type { QueryResult } from "@/lib/engine/types";

const st = () => useExplorerStore.getState();

beforeEach(() => {
  resetPositionCache();
  useExplorerStore.setState({ path: [], cursor: 0, hoverMove: null, filters: { color: "white" }, result: null });
});

describe("playMove (C7)", () => {
  it("ignores illegal input and never wipes the line", () => {
    st().playMove("e4");
    st().playMove("e5");
    const before = st().path;
    st().playMove("e5"); // illegal for White here (a stale table row)
    st().playMove("Nge7");
    st().playMove("");
    expect(st().path).toBe(before);
    expect(st().path).toEqual(["e4", "e5"]);
    expect(st().cursor).toBe(2);
  });
  it("stores chess.js SAN and keeps the redo branch", () => {
    for (const m of ["e4", "e5", "Bc4", "Nc6", "Bxf7"]) st().playMove(m);
    expect(st().path.at(-1)).toBe("Bxf7+");
    st().undo();
    st().undo();
    st().playMove("Nc6"); // the next move of the branch
    expect(st().cursor).toBe(4);
    expect(st().path).toHaveLength(5);
    st().playMove("Qh5"); // a different move cuts the branch
    expect(st().path).toEqual(["e4", "e5", "Bc4", "Nc6", "Qh5"]);
  });
  it("plays from the cursor, not the end of the line", () => {
    st().setLine(["d4", "d5", "c4"]);
    st().goTo(1);
    st().playMove("Nf6");
    expect(st().path).toEqual(["d4", "Nf6"]);
  });
});

describe("setLine", () => {
  it("keeps the legal prefix as chess.js SAN", () => {
    st().setLine(["e4", "e5", "Qh5", "Nc6", "Bc4", "Nf6", "Qxf7", "Ke7"]);
    expect(st().path).toEqual(["e4", "e5", "Qh5", "Nc6", "Bc4", "Nf6", "Qxf7#"]);
    expect(st().cursor).toBe(7);
    st().setLine(["e4", "e4"]);
    expect(st().path).toEqual(["e4"]);
  });
});

describe("persist migration v2 (C5)", () => {
  it("drops the move range from stored filters", () => {
    const v1 = { selected: "all", filters: { color: "black", moves_start: 1, moves_end: 10, result: "1-0" }, orientation: "black", sideChosen: true };
    expect(migratePersisted(v1, 1)).toMatchObject({ filters: { color: "black", result: "1-0" }, sideChosen: true });
    expect(migratePersisted(v1, 1).filters).not.toHaveProperty("moves_start");
    expect(migratePersisted(v1, 1).filters).not.toHaveProperty("moves_end");
  });
  it("still runs the v0 side migration", () => {
    expect(migratePersisted({ filters: { moves_end: 4 } }, 0)).toMatchObject({ filters: { color: "white" }, orientation: "white", sideChosen: false });
    expect(migratePersisted({ filters: { color: "black" } }, 0)).toMatchObject({ orientation: "black", sideChosen: true });
  });
  it("setFilters never stores a move range; the count and worker filters ignore it", () => {
    st().setFilters({ moves_start: 2, moves_end: 20, result: "1-0" });
    expect(st().filters).toEqual({ color: "white", result: "1-0" });
    expect(activeFilterCount({ moves_start: 1, moves_end: 4 })).toBe(0);
    expect(activeFilterCount({ date_preset: 30 })).toBe(1);
    expect(selectionFilters({ color: "white", moves_start: 1, moves_end: 3 })).toEqual({ color: "white" });
  });
});

describe("isResultFresh (C7)", () => {
  const r = (path: string[]) => ({ path }) as unknown as QueryResult;
  it("is true only for the shown position", () => {
    expect(isResultFresh({ result: null, path: [], cursor: 0 })).toBe(false);
    expect(isResultFresh({ result: r(["e4"]), path: ["e4", "e5"], cursor: 1 })).toBe(true);
    expect(isResultFresh({ result: r(["e4"]), path: ["e4", "e5"], cursor: 2 })).toBe(false);
    expect(isResultFresh({ result: r([]), path: ["e4"], cursor: 0 })).toBe(true);
  });
});

describe("position cache (C15)", () => {
  it("returns the same object for the same line and extends incrementally", () => {
    const a = ["e4", "e5", "Nf3"];
    const lp = linePositions(a);
    expect(linePositions(a)).toBe(lp);
    const c = new Chess();
    for (const m of a) c.move(m);
    expect(lp.fens[3]).toBe(c.fen());
    expect(lp.lastMoves[2]).toEqual({ from: "g1", to: "f3" });
    const b = [...a, "Nc6"];
    const lp2 = linePositions(b);
    c.move("Nc6");
    expect(lp2.fens[4]).toBe(c.fen());
    expect(lp2.sans).toEqual(["e4", "e5", "Nf3", "Nc6"]);
    // branch off earlier: shares the prefix, replays the rest
    const lp3 = linePositions(["e4", "c5"]);
    expect(lp3.sans).toEqual(["e4", "c5"]);
    expect(lp3.fens[1]).toBe(lp2.fens[1]);
  });
  it("stops at the first illegal move", () => {
    const lp = linePositions(["e4", "e4", "e5"]);
    expect(lp.sans).toEqual(["e4"]);
    expect(lp.fens).toHaveLength(2);
  });
  it("canonicalLine", () => {
    expect(canonicalLine(["e4", "e5", "Bc4", "Nc6", "Bxf7", "Kxf7"])).toEqual(["e4", "e5", "Bc4", "Nc6", "Bxf7+", "Kxf7"]);
  });
});

describe("URL ?line= (C16)", () => {
  const get = (search: string) => new URLSearchParams(search).get("line");
  it("restores '+' decoded as a space, accepts %2B and a missing '+'", () => {
    expect(parseLineParam(get("?line=e4,e5,Bc4,Nc6,Bxf7+,Kxf7"))).toEqual(["e4", "e5", "Bc4", "Nc6", "Bxf7+", "Kxf7"]);
    expect(parseLineParam(get("?line=e4,e5,Bc4,Nc6,Bxf7%2B,Kxf7"))).toEqual(["e4", "e5", "Bc4", "Nc6", "Bxf7+", "Kxf7"]);
    expect(parseLineParam(get("?line=e4,e5,Bc4,Nc6,Bxf7,Kxf7"))).toEqual(["e4", "e5", "Bc4", "Nc6", "Bxf7+", "Kxf7"]);
    expect(parseLineParam(get("?line=f3,e5,g4,Qh4%23"))).toEqual(["f3", "e5", "g4", "Qh4#"]);
  });
  it("keeps the legal prefix", () => {
    expect(parseLineParam(get("?line=e4,e5,Ke7,Nf3"))).toEqual(["e4", "e5"]);
    expect(parseLineParam(null)).toEqual([]);
  });
});

describe("auto side (C12)", () => {
  it("first summary: the side with more games, including a Black-only player", () => {
    expect(autoSide({ games: 0, counts: { white: 0, black: 2 } }, "white", false, 0)).toBe("black");
    expect(autoSide({ games: 3, counts: { white: 3, black: 2 } }, "white", false, 0)).toBeNull();
    expect(autoSide({ games: 0, counts: { white: 0, black: 0 } }, "white", false, 0)).toBeNull();
  });
  it("after a choice: only when the side has no games at all and no filter is active", () => {
    expect(autoSide({ games: 0, counts: { white: 0, black: 5 } }, "white", true, 0)).toBe("black");
    expect(autoSide({ games: 0, counts: { white: 0, black: 5 } }, "white", true, 1)).toBeNull();
    expect(autoSide({ games: 1, counts: { white: 1, black: 5 } }, "white", true, 0)).toBeNull();
  });
});
