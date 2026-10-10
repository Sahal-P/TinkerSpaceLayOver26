import { describe, expect, it } from "vitest";

import { formatClock, formatDistance, seededRandom, walkingMinutes } from "./format";

describe("format", () => {
  it("formats clocks", () => {
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(47.9)).toBe("0:47");
    expect(formatClock(125)).toBe("2:05");
  });

  it("formats distances", () => {
    expect(formatDistance(80)).toBe("80 m");
    expect(formatDistance(1250)).toBe("1.3 km");
  });

  it("estimates walking time, never under a minute", () => {
    expect(walkingMinutes(0)).toBe(1);
    expect(walkingMinutes(650)).toBe(9);
  });

  it("generates the same sequence for the same seed", () => {
    const a = seededRandom(42);
    const b = seededRandom(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});
