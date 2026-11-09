import { describe, expect, it } from "vitest";
import { lookupOpening, openingCount } from "@/lib/openings/lookup";

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
