import { describe, expect, it } from "vitest";

import { demoJourney, lensScenarios, lensVerdict, processingStages } from "./fixtures";
import { journeySchema, lensScenarioSchema, processingStageSchema, stepDraftSchema } from "./schemas";

describe("fixtures", () => {
  it("match the Zod schemas", () => {
    expect(() => journeySchema.parse(demoJourney)).not.toThrow();
    expect(() => processingStageSchema.array().parse(processingStages)).not.toThrow();
    expect(() => lensScenarioSchema.array().parse(lensScenarios)).not.toThrow();
  });

  it("highlight phrases that actually appear in the transcript", () => {
    for (const segment of demoJourney.transcript) {
      for (const highlight of segment.highlights) {
        expect(segment.original).toContain(highlight.original);
        expect(segment.translation).toContain(highlight.translation);
      }
    }
  });

  it("produce a verdict for each scenario", () => {
    const step = journeySchema.parse(demoJourney).steps[3];
    if (!step) throw new Error("Missing demo step");
    for (const scenario of lensScenarios) {
      expect(lensVerdict(scenario, step).outcome).toBe(scenario.outcome);
    }
  });
});

describe("stepDraftSchema", () => {
  it("coerces form distance and reports readable errors", () => {
    expect(stepDraftSchema.parse({ instruction: "Go left", landmark: "Church", direction: "left", distanceM: "120" }).distanceM).toBe(120);
    const result = stepDraftSchema.safeParse({ instruction: "", landmark: "C", direction: "left", distanceM: "-5" });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.message)).toEqual(
      expect.arrayContaining(["Describe the step in a few words.", "Name the landmark to look for.", "Distance can't be negative."]),
    );
  });
});
