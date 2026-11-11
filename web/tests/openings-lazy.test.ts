import { describe, expect, it } from "vitest";
import { loadOpenings, lookupOpening, openingCount, openingsVersion } from "@/lib/openings/lookup";

// Own file: the dataset must not have been loaded by another test in this module instance.
describe("lazy loading", () => {
  it("names nothing until the dataset chunk has loaded, then bumps the version", async () => {
    const before = openingsVersion();
    expect(openingCount()).toBe(0);
    expect(lookupOpening(["e4", "c5"])).toBeNull();
    await loadOpenings();
    expect(openingCount()).toBeGreaterThan(3000);
    expect(openingsVersion()).toBe(before + 1);
    expect(lookupOpening(["e4", "c5"])?.name).toBe("Sicilian Defense");
  });
});
