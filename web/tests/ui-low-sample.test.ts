import { describe, expect, it } from "vitest";
import { isLowSample } from "@/components/explorer/rare";

describe("isLowSample", () => {
  it("flags fewer than 3 games", () => {
    expect(isLowSample(2, 10)).toBe(true);
    expect(isLowSample(3, 10)).toBe(false);
  });
  it("flags under 5% only when the position has 40+ games", () => {
    expect(isLowSample(4, 100)).toBe(true);
    expect(isLowSample(5, 100)).toBe(false);
    expect(isLowSample(3, 39)).toBe(false);
  });
});
