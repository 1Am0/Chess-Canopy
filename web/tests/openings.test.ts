import { beforeAll, describe, expect, it } from "vitest";
import { buildIndex, loadOpenings, lookupOpening, openingCount } from "@/lib/openings/lookup";

beforeAll(async () => {
  await loadOpenings();
});

describe("transpositions (M10)", () => {
  it("names 1.Nf3 d5 2.d4 like 1.d4 d5 2.Nf3 (not just 'Zukertort Opening')", () => {
    const direct = lookupOpening(["d4", "d5", "Nf3"]);
    expect(direct?.name).toBe("Queen's Pawn Game: Zukertort Variation");
    expect(lookupOpening(["Nf3", "d5", "d4"])).toEqual(direct);
  });
  it("names 1.c4 e6 2.Nc3 d5 3.d4 like 1.d4 d5 2.c4 e6 3.Nc3", () => {
    const direct = lookupOpening(["d4", "d5", "c4", "e6", "Nc3"]);
    expect(direct?.name).toContain("Queen's Gambit Declined");
    expect(lookupOpening(["c4", "e6", "Nc3", "d5", "d4"])).toEqual(direct);
  });
  it("prefers the shortest line when several reach one position", () => {
    const idx = buildIndex([
      ["A00", "Long alias", "d4 d5 c4 e6 Nc3 Nf6"],
      ["A00", "Short alias", "Nc3 Nf6 c4 e6 d4 d5"],
      ["D37", "Short", "d4"],
    ]);
    expect(idx.byLine.size).toBe(3);
    expect(idx.byEpd.size).toBe(2);
    expect([...idx.byEpd.values()].map((e) => e.name).sort()).toEqual(["Long alias", "Short"].sort());
  });
});

describe("lookupOpening", () => {
  it("finds the Sicilian Defense after 1.e4 c5", () => {
    expect(lookupOpening(["e4", "c5"])).toMatchObject({ eco: "B20", name: "Sicilian Defense" });
  });

  it("finds the Najdorf for the full 6...a6 line", () => {
    const result = lookupOpening(["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "a6"]);
    expect(result?.name).toContain("Najdorf");
    expect(result?.family).toBe("Sicilian Defense");
  });

  it("returns the longest known prefix for an unknown continuation", () => {
    const line = ["e4", "c5", "Nf3", "d6", "d4", "cxd4", "Nxd4", "Nf6", "Nc3", "a6", "h3", "h6"];
    expect(lookupOpening(line)?.name).toContain("Najdorf");
  });

  it("ignores move annotations", () => {
    expect(lookupOpening(["e4", "c5+"])?.name).toBe("Sicilian Defense");
  });

  it("returns null for an empty line", () => {
    expect(lookupOpening([])).toBeNull();
  });

  it("returns null when no prefix is known", () => {
    expect(lookupOpening(["a9"])).toBeNull();
  });

  it("omits family when the name has no colon", () => {
    const result = lookupOpening(["e4", "c5"]);
    expect(result).not.toBeNull();
    expect(result).not.toHaveProperty("family");
  });
});

describe("openingCount", () => {
  it("reports the bundled dataset size", () => {
    expect(openingCount()).toBeGreaterThan(3000);
  });
});

describe("lookupOpening with check marks (C6)", () => {
  it("finds lines whose index key contains a check", () => {
    expect(lookupOpening(["e4", "c5", "Nf3", "d6", "Bb5+"])).toMatchObject({ eco: "B51" });
    expect(lookupOpening(["e4", "c5", "Nf3", "d6", "Bb5"])).toMatchObject({ eco: "B51" });
  });
  it("finds Fool's Mate (a '#' key)", () => {
    expect(lookupOpening(["f3", "e5", "g4", "Qh4#"])?.name).toBe("Barnes Opening: Fool's Mate");
  });
});
