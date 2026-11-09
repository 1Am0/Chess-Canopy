import { describe, expect, it } from "vitest";
import { Chess } from "chess.js";
import { chessJsLegal, FastBoard, replayCheck } from "@/lib/engine/legal";
import { isStandardPlay } from "@/lib/importers/standard";

const play = (moves: string[]) => {
  const b = new FastBoard();
  return moves.map((m) => b.playSan(m));
};
const ok = (moves: string[]) => play(moves).every((r) => r === "ok");

describe("FastBoard", () => {
  it("plays ordinary games and agrees with chess.js", () => {
    const lines = [
      "e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6 c3 O-O h3 Nb8 d4 Nbd7",
      "d4 d5 c4 e6 Nc3 Nf6 Bg5 Be7 e3 O-O Nf3 h6 Bh4 b6 cxd5 Nxd5 Bxe7 Qxe7 Nxd5 exd5",
      "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be3 e5 Nb3 Be6 f3 Be7 Qd2 O-O O-O-O Nbd7 g4 b5",
    ];
    for (const l of lines) {
      const moves = l.split(" ");
      expect(ok(moves), l).toBe(true);
      const c = new Chess();
      for (const m of moves) c.move(m);
    }
  });
  it("en passant, promotion and under-promotion", () => {
    expect(ok("e4 a6 e5 d5 exd6".split(" "))).toBe(true);
    expect(ok("e4 a6 e5 d5 Nf3 h6 exd6".split(" "))).toBe(false); // e.p. right expired
    expect(ok("h4 g5 hxg5 h6 gxh6 Nf6 h7 Ng8 hxg8=N".split(" "))).toBe(true);
    expect(ok("h4 g5 hxg5 h6 gxh6 Nf6 h7 Ng8 hxg8Q".split(" "))).toBe(true);
    expect(ok("h4 g5 hxg5 h6 gxh6 Nf6 hxg7".split(" "))).toBe(false); // nothing on g7
    expect(ok("e4 e5 e8=Q".split(" "))).toBe(false);
  });
  it("castling rules: through check, after moving, blocked", () => {
    // Bc5 controls f2? no; Bc5 + Qh4 ideas: use a bishop on c4 eyeing f1 instead
    expect(ok("e4 e5 Nf3 Nc6 Bc4 Bc5 O-O".split(" "))).toBe(true);
    expect(ok("e4 e5 Nf3 Nc6 Bc4 Bc5 Ke2 Nf6 Ke1 Ng4 O-O".split(" "))).toBe(false); // king moved
    expect(ok("e4 e5 Nf3 Nc6 O-O".split(" "))).toBe(false); // f1 bishop in the way
    // g1 attacked by the bishop on c5 after f2 is gone
    expect(ok("e4 e5 Nf3 Bc5 Bc4 Nf6 Nxe5 Nxe4 Nxf7 Bxf2+ Kf1".split(" "))).toBe(true);
    expect(ok("f4 e5 Nf3 Bc5 e3 Nf6 Be2 a6 Rf1 b6 Rh1 c6 O-O".split(" "))).toBe(false); // rook moved
  });
  it("agrees with chess.js on tricky lines", () => {
    const lines = [
      "e3 b6 Nf3 Ba6 Bc4 Bxc4 O-O", // f1 attacked: no castling
      "e3 b6 Nf3 Ba6 Bc4 Bxc4 d3 Bxd3 cxd3 e6 O-O", // fine now
      "d4 e5 Nc3 exd4 Qxd4 Nc6 Bf4 d6 O-O-O", // b1 empty, d1/c1 safe
      "e4 d5 Bb5+ c6 Nf3 cxb5 O-O", // castling while... legal
      "e4 f5 Qh5+ g6 Qxg6+ hxg6", // capture with check
      "e4 e5 Ke2 Ke7 Ke3 Ke6 Kd3 Kd6 Kc4 Kc5 Kxc5", // illegal: kings adjacent / capture
      "d4 c6 d5 Qa5+ c3 Qxd5 Qxd5 cxd5 e4 dxe4 Bb5 Kd8 Bxd7 Bxd7", // pins and captures
      "e4 e5 Nf3 Nc6 Bb5 a6 Ba4 b5 Bb3 Nf6 O-O Nxe4 Re1 d5 a4 Be6 axb5",
      "a4 b5 axb5 a5 bxa6 Bb7 axb7 Nc6 bxa8=Q Qxa8 Rxa8+ Kd8",
    ];
    for (const l of lines) expect(ok(l.split(" ")), l).toBe(chessJsLegal(l.split(" ")));
  });
  it("pins, ambiguity and over-disambiguation", () => {
    // Nc3 pinned by Bb4 after d3? Use e4 e5 d4 Bb4+ c3 ... simpler: knight pinned to king
    expect(ok("d4 e5 dxe5 Bb4+ Nc3 Ne7 Nd5".split(" "))).toBe(false); // pinned knight
    expect(ok("d4 d5 Nf3 Nf6 Nd2".split(" "))).toBe(false); // ambiguous: Nbd2 or Nfd2
    expect(ok("d4 d5 Nf3 Nf6 Nbd2".split(" "))).toBe(true);
    expect(ok("e4 e6 d4 Nge7".split(" "))).toBe(true); // over-disambiguated but unique (chess.js accepts)
    expect(ok("e4 Nge7".split(" "))).toBe(false); // e7 is occupied
  });
  it("check marks: wrong '#' is reported, missing marks are fine", () => {
    expect(play("f3 e5 g4 Qh4#".split(" ")).at(-1)).toBe("ok");
    expect(play("f3 e5 g4 Qh4".split(" ")).at(-1)).toBe("ok");
    expect(play("e4 e5 Qh5 Nc6 Qxf7#".split(" ")).at(-1)).toBe("badmark"); // Kxf7 is possible
    expect(play("e4 e5 Nf3+".split(" ")).at(-1)).toBe("badmark");
  });
});

describe("replayCheck / isStandardPlay", () => {
  it("confirms rejections with chess.js", () => {
    expect(replayCheck(["e4", "e5"])).toEqual({ legal: true, badMarks: false });
    expect(replayCheck(["e4", "Ke7", "Ke2", "Ke8", "Nc3", "N@e4"]).legal).toBe(false);
    // long algebraic: FastBoard rejects, chess.js's permissive parser accepts, so it is legal
    expect(replayCheck(["e2e4", "e7e5"]).legal).toBe(true);
  });
  it("drops drops, variant terminations and bad marks", () => {
    expect(isStandardPlay(["e4", "e5"], "Hero won by resignation")).toBe(true);
    expect(isStandardPlay(["e4", "e5"], "Hero won by checking the opponent king for the 3rd time")).toBe(false);
    expect(isStandardPlay(["e4", "e5"], "Hero won by the king reaching the hill")).toBe(false);
    expect(isStandardPlay(["e4", "e5", "Qh5", "Nc6", "Qxf7#"])).toBe(false);
    expect(isStandardPlay(["e4", "d5", "exd5", "Qxd5", "N@f3"])).toBe(false);
  });
});
