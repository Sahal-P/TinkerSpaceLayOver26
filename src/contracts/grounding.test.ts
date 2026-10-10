import { describe, expect, it } from "vitest";
import { normalizeDistance } from "./distance";
import { supportsDirection, supportsIncline } from "./evidence";
import { englishFixture } from "./fixtures";
import { guideDraftSchema, type Direction } from "./guide";

describe("conservative grounding regressions", () => {
  it.each(["three to five meters", "-50 meters", "−50 meters", "no more than 100 meters", "at least ten feet", "about fifty meters", "one hundred–two hundred meters", "100 m or 100 m", "five minutes", "minus fifty meters"])("preserves uncertainty for %s", (phrase) => {
    expect(normalizeDistance(phrase)).toBeNull();
  });
  it.each<[Direction, string]>([["straight", "Do not go straight."], ["arrive", "The clinic is not the destination."], ["start", "Never start at the bridge."], ["left", "The shop is on the left."], ["u_turn", "Do not make a U-turn."]])("rejects unsupported %s in %s", (direction, quote) => {
    expect(supportsDirection(direction, quote)).toBe(false);
    const guide = structuredClone(englishFixture); const step = guide.steps[0];
    if (!step) throw new Error("Missing fixture");
    guide.transcript = { original: quote, translation: quote, segments: [{ id: "s1", original: quote, translation: quote, startSec: null, endSec: null }] };
    guide.steps = [{ ...step, instruction: quote, direction, landmark: { spoken: null, label: null }, evidence: { original: quote, translation: quote, startSec: null } }];
    expect(guideDraftSchema.safeParse(guide).success).toBe(false);
  });
  it("keeps a hyphenated scalar", () => { expect(normalizeDistance("twenty-five meters")).toBe(25); });
  it("keeps a positive instruction after a prohibition and preserves hedging", () => {
    expect(supportsDirection("right", "Do not turn left, but turn right.")).toBe(true);
    expect(supportsDirection("left", "Turn left, I am not sure.")).toBe(true);
    expect(supportsIncline("up", "Do not climb the stairs.")).toBe(false);
    expect(supportsIncline("down", "Head downhill.")).toBe(true);
  });
});
