import { describe, expect, it } from "vitest";

import { explicitDistances, normalizeDistance } from "./distance";
import { ambiguousFixture, englishFixture, guideFixtures } from "./fixtures";
import { createGuideSchema, guideDraftSchema, reviewedGuideSchema } from "./guide";

describe("multilingual guide contracts", () => {
  it.each(Object.entries(guideFixtures))("validates the %s integration fixture", (_, fixture) => {
    expect(guideDraftSchema.safeParse(fixture).success).toBe(true);
  });
  it("rejects GPS, UI fields, and invented facts instead of silently stripping them", () => {
    expect(guideDraftSchema.safeParse({ ...englishFixture, latitude: 12 }).success).toBe(false);
    for (const change of [
      { landmark: { spoken: "nonexistent temple", label: "temple" } },
      { distance: { spoken: "two hundred meters", meters: 500 } },
      { instruction: "Turn right at an invented temple." },
      { anchor: "tram" },
    ]) {
      const guide = structuredClone(englishFixture);
      Object.assign(guide.steps[1] ?? {}, change);
      expect(guideDraftSchema.safeParse(guide).success).toBe(false);
    }
  });
  it("rejects reordered evidence and a forged transcript", () => {
    const reversed = { ...englishFixture, steps: [...englishFixture.steps].reverse() };
    expect(guideDraftSchema.safeParse(reversed).success).toBe(false);
    expect(guideDraftSchema.safeParse({ ...englishFixture, transcript: { ...englishFixture.transcript, original: "made up" } }).success).toBe(false);
  });
  it("validates malformed language codes without throwing and rejects fabricated timing", () => {
    const bad = structuredClone(englishFixture);
    if (bad.languages.detected[0]) bad.languages.detected[0].code = "%%invalid%%";
    expect(() => guideDraftSchema.safeParse(bad)).not.toThrow();
    expect(guideDraftSchema.safeParse(bad).success).toBe(false);
    const timing = structuredClone(englishFixture);
    if (timing.steps[0]?.evidence) timing.steps[0].evidence.startSec = 25;
    expect(guideDraftSchema.safeParse(timing).success).toBe(false);
  });
  it("prevents matching the original quote to another segment's translation", () => {
    const bad = structuredClone(englishFixture);
    const turn = bad.steps[2];
    const start = bad.steps[0]?.evidence;
    if (!turn || !turn.evidence || !start) throw new Error("Missing fixture step");
    turn.evidence.original = start.original;
    turn.landmark.spoken = "bus stop";
    expect(guideDraftSchema.safeParse(bad).success).toBe(false);
  });
  it("rejects expanded transcripts above the serialized guide byte ceiling", () => {
    const source = "മ".repeat(3990);
    const originals = [source, source, "Start at the bus stop."];
    const translations = ["A".repeat(3990), "B".repeat(3990), "Start at the bus stop."];
    const base = structuredClone(englishFixture);
    base.transcript = {
      original: originals.join(" "), translation: translations.join(" "),
      segments: originals.map((original, index) => ({
        id: "s" + index, original, translation: translations[index] ?? "", startSec: null, endSec: null,
      })),
    };
    const template = englishFixture.steps[0];
    if (!template) throw new Error("Missing fixture step");
    base.steps = Array.from({ length: 40 }, (_, index) => ({
      ...structuredClone(template), id: "expanded-" + index, source: "user" as const, evidence: null,
      instruction: "മ".repeat(990), landmark: { spoken: null, label: null },
    }));
    expect(guideDraftSchema.safeParse(base).success).toBe(false);
  });
  it("requires confirmation and every step's review without clearing uncertainty", () => {
    expect(createGuideSchema.safeParse({ guide: englishFixture, confirmed: true }).success).toBe(false);
    const reviewed = { ...ambiguousFixture, steps: ambiguousFixture.steps.map((step) => ({ ...step, reviewed: true })) };
    expect(reviewedGuideSchema.parse(reviewed).needsReview).toBe(true);
    expect(createGuideSchema.safeParse({ guide: reviewed, confirmed: false }).success).toBe(false);
    const lowered = structuredClone(reviewed);
    if (lowered.steps[0]) lowered.steps[0].confidence = "high";
    expect(reviewedGuideSchema.safeParse(lowered).success).toBe(false);
  });
  it("accepts explicit human corrections with no manufactured audio evidence", () => {
    const guide = structuredClone(englishFixture);
    if (guide.steps[1]) {
      guide.steps[1] = { ...guide.steps[1], source: "user", evidence: null, instruction: "Go to the grocery.", landmark: { spoken: null, label: "Grocery" }, distance: { spoken: "100 m", meters: 100 }, reviewed: true };
    }
    expect(guideDraftSchema.safeParse(guide).success).toBe(true);
    if (guide.steps[1]) guide.steps[1].evidence = { original: "fake", translation: "fake", startSec: null };
    expect(guideDraftSchema.safeParse(guide).success).toBe(false);
  });
  it("rejects missing-distance zero defaults, duplicate IDs, invalid numbers, unsupported languages, and excessive steps", () => {
    const mutations = [
      { steps: englishFixture.steps.map((step) => ({ ...step, id: "same" })) },
      { steps: Array.from({ length: 41 }, (_, i) => ({ ...englishFixture.steps[0], id: String(i) })) },
      { languages: { detected: [{ code: "fr", confidence: "high" }], target: "en" } },
    ];
    for (const mutation of mutations) expect(guideDraftSchema.safeParse({ ...englishFixture, ...mutation }).success).toBe(false);
    for (const meters of [0, NaN, Infinity, -1]) {
      const guide = structuredClone(englishFixture);
      if (guide.steps[0]) guide.steps[0].distance.meters = meters;
      expect(guideDraftSchema.safeParse(guide).success).toBe(false);
    }
  });
});

describe("spoken distance normalization", () => {
  it.each([
    ["200 meters", 200], ["two hundred meters", 200], ["two hundred and fifty metres", 250],
    ["a hundred meters", 100], ["half a kilometer", 500], ["one and a half kilometers", 1500],
    ["1.25km", 1250], ["1,200 m", 1200], ["ten feet", 3.048], ["a quarter mile", 402.336], ["zero m", 0],
  ])("normalizes explicitly stated %s", (text, expected) => {
    expect(normalizeDistance(text)).toBeCloseTo(expected);
  });
  it.each(["five minutes", "a little further", "quite far", "100 to 200 meters", "100–200 m", "about one or two hundred meters", "one two meters"])("does not invent a value for %s", (text) => {
    expect(normalizeDistance(text)).toBeNull();
  });
  it("keeps separate explicit references separate", () => {
    expect(explicitDistances("Go 100 m, then 200 meters.")).toEqual([100, 200]);
    expect(normalizeDistance("Go 100 m, then 200 meters.")).toBeNull();
  });
});
