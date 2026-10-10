import { describe, expect, it } from "vitest";
import { englishFixture, ambiguousFixture } from "./fixtures";
import { englishNarration, narrationInput, narrationText, narrationInputSchema, speechChunks, speechRequestSchema } from "./speech";

describe("canonical speech contracts", () => {
  it("retains nulls, unknown directions and exact zero without narrating review warnings", () => {
    const input = narrationInput(ambiguousFixture.steps[0], ambiguousFixture.warnings);
    if (!input) throw new Error("Missing fixture");
    expect(narrationInputSchema.parse(input)).toEqual(input);
    const sections = englishNarration(input);
    expect(sections.warnings).toEqual([]);
    expect(input.step.warnings.length + input.routeWarnings.length).toBeGreaterThan(0);
    input.step.distance = { spoken: null, meters: null }; input.step.landmark = { spoken: null, label: null };
    expect(englishNarration(input)).toMatchObject({ landmark: null, distance: null });
    input.step.distance = { spoken: "zero meters", meters: 0 };
    expect(englishNarration(input).distance).toBe("0 meters");
  });
  it("omits transcript/evidence/session data from narration input", () => {
    const input = narrationInput(englishFixture.steps[0], []);
    expect(input?.step).not.toHaveProperty("evidence");
    expect(narrationInput(undefined, [])).toBeNull();
    expect(narrationInputSchema.safeParse({ ...input, latitude: 12 }).success).toBe(false);
  });
  it("splits narration losslessly within provider limits, including surrogate pairs", () => {
    for (const text of ["A.".repeat(900), "Go left. ".repeat(160), "🚶".repeat(900)]) {
      const parts = speechChunks(text);
      expect(parts.join("")).toBe(text);
      expect(parts.every(part => part.length <= 600)).toBe(true);
      expect(parts.every(part => !/^[\uDC00-\uDFFF]/.test(part))).toBe(true);
    }
    expect(speechRequestSchema.safeParse({ text: "x".repeat(601), language: "en" }).success).toBe(false);
    expect(narrationText({ instruction: "Maybe turn left", landmark: null, distance: null, warnings: ["Not certain. Confirm with the speaker."] })).toBe("Maybe turn left");
    expect(narrationText({ instruction: "Turn left.", landmark: "bridge", distance: null, warnings: [] })).toBe("Turn left. bridge");
  });
});
