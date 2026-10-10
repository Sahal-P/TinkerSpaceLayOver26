import { describe, expect, it } from "vitest";
import { guideDraftSchema } from "@/contracts/guide";
import { demoDraft, lensScenarios, lensVerdict } from "./fixtures";
import { lensScenarioSchema, stepDraftSchema } from "./schemas";
import { presentStep } from "./presentation";

describe("canonical demo and form conversion", () => {
  it("validates the demo against the backend and never invents live anchors", () => {
    expect(guideDraftSchema.parse(demoDraft).languages.detected[0]?.code).toBe(
      "en",
    );
    expect(lensScenarioSchema.array().parse(lensScenarios)).toHaveLength(3);
    const step = demoDraft.steps[1];
    if (!step) throw new Error("Missing fixture");
    expect(presentStep(step, 1).anchor).toBeNull();
    for (const scenario of lensScenarios)
      expect(lensVerdict(scenario, presentStep(step, 1, true)).outcome).toBe(
        scenario.outcome,
      );
  });
  it.each([
    ["", null],
    ["0", 0],
    ["3.048", 3.048],
  ])("preserves nullable/decimal distance %s", (raw, expected) => {
    expect(
      stepDraftSchema.parse({
        instruction: "Continue",
        landmark: "",
        direction: "straight",
        incline: "",
        distanceM: raw,
      }).distanceM,
    ).toBe(expected);
  });
  it.each(["-5", "NaN", "Infinity", "1e4", "1,2"])(
    "rejects invalid distance %s",
    (value) => {
      expect(
        stepDraftSchema.safeParse({
          instruction: "Continue",
          landmark: "",
          direction: "straight",
          incline: "",
          distanceM: value,
        }).success,
      ).toBe(false);
    },
  );
  it("allows missing landmarks and rejects unknown fields", () => {
    const fields = {
      instruction: "Continue",
      landmark: "",
      direction: "unknown",
      incline: "",
      distanceM: "",
    };
    expect(stepDraftSchema.parse(fields).landmark).toBeNull();
    expect(stepDraftSchema.safeParse({ ...fields, gps: 12 }).success).toBe(
      false,
    );
  });
});
