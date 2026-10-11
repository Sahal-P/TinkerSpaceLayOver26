import { describe, expect, it } from "vitest";
import { englishFixture } from "./fixtures";
import { supportsDirection } from "./evidence";
import { findEvidenceSpan } from "./evidence-span";
import { guideDraftSchema } from "./guide";
import { refineNavigationSteps } from "./refine-navigation";
import { hasUnresolvedPlaceReference, isFactFreeTransition, isNavigationTransition } from "./navigation-quality";

describe("complete navigation actions", () => {
  it.each(["After reaching there", "After reaching there,", "After you reach there", "Having reached there", "When the bus arrives at the station", "When you arrive at the station", "Once you are there", "From there", "After that", "Then"])("does not expose %s as an arrival instruction", text => {
    expect(isNavigationTransition(text)).toBe(true);
    expect(supportsDirection("arrive", text)).toBe(false);
  });
  it.each(["After reaching the clinic, turn left.", "After reaching there take an auto to the bridge.", "Then board bus 12 at the bus stop.", "After getting off the bus, walk to the bridge."])("retains the complete action %s", text => {
    expect(isNavigationTransition(text)).toBe(false);
    expect(supportsDirection("arrive", text)).toBe(false);
  });
  it("distinguishes conditions and an end-of-street landmark from real arrival/completion", () => {
    expect(supportsDirection("arrive", "After reaching the clinic, stop.")).toBe(true);
    expect(supportsDirection("arrive", "You have reached the clinic.")).toBe(true);
    expect(supportsDirection("arrive", "Walk to the end of the street.")).toBe(false);
    expect(supportsDirection("arrive", "Do not arrive at the clinic.")).toBe(false);
    expect(supportsDirection("left", "After reaching the clinic, turn left.")).toBe(true);
  });
  it("flags unnamed places without mistaking a quoted landmark name for a pronoun", () => {
    expect(hasUnresolvedPlaceReference("Turn left there.", null)).toBe(true);
    expect(hasUnresolvedPlaceReference("Walk toward that place.", null)).toBe(true);
    expect(hasUnresolvedPlaceReference("Turn left at There Cafe.", "There Cafe")).toBe(false);
    expect(hasUnresolvedPlaceReference("Turn left at the bridge. There are two bakeries nearby.", "bridge")).toBe(false);
    expect(hasUnresolvedPlaceReference("After reaching there, turn left at the bridge.", "bridge")).toBe(true);
  });
  it("never treats a factual transition as disposable just because model fields are empty", () => {
    expect(isFactFreeTransition("After reaching there")).toBe(true);
    for (const text of ["After reaching the clinic", "After reaching there in 200 meters", "When the bus arrives there"]) {
      expect(isNavigationTransition(text)).toBe(true); expect(isFactFreeTransition(text)).toBe(false);
    }
    const template = englishFixture.steps[0];
    if (!template) throw new Error("Missing fixture");
    const text = "After reaching the clinic";
    const transcript = { original: text, translation: text, segments: [{ id: "s1", original: text, translation: text, startSec: null, endSec: null }] };
    const step = { ...template, instruction: text, direction: "unknown" as const, landmark: { spoken: null, label: null },
      evidence: { original: text, translation: text, startSec: null } };
    expect(refineNavigationSteps([step], transcript).steps).toHaveLength(1);
  });
  it("rejects standalone transitions and unflagged place references at canonical boundaries", () => {
    for (const instruction of ["After reaching there", "Turn left there."]) {
      const guide = structuredClone(englishFixture);
      const step = guide.steps[2]; const segment = guide.transcript.segments[2];
      if (!step || !segment) throw new Error("Missing fixture");
      segment.original = segment.translation = instruction;
      step.instruction = instruction; step.evidence = { original: instruction, translation: instruction, startSec: null };
      step.landmark = { spoken: null, label: null }; step.direction = instruction.startsWith("After") ? "arrive" : "left";
      guide.transcript.original = guide.transcript.segments.map(s => s.original).join(" ");
      guide.transcript.translation = guide.transcript.segments.map(s => s.translation).join(" ");
      expect(guideDraftSchema.safeParse(guide).success).toBe(false);
    }
  });
});

describe("paired adjacent evidence spans", () => {
  const segments = [
    { id: "s1", original: "वहाँ पहुँचकर,", translation: "After reaching there,", startSec: null, endSec: null },
    { id: "s2", original: "बाएँ मुड़ें।", translation: "turn left.", startSec: null, endSec: null },
    { id: "s3", original: "पुल पार करें।", translation: "Cross the bridge.", startSec: null, endSec: null },
  ];
  const transcript = { original: segments.map(s => s.original).join(" "), translation: segments.map(s => s.translation).join(" "), segments };
  it("allows only exact spans covering matching segments in both languages", () => {
    expect(findEvidenceSpan(transcript, { original: "वहाँ पहुँचकर, बाएँ मुड़ें।", translation: "After reaching there, turn left.", startSec: null })).not.toBeNull();
    for (const evidence of [
      { original: "वहाँ पहुँचकर, बाएँ मुड़ें।", translation: "Cross the bridge." },
      { original: "वहाँ पहुँचकर,", translation: "After reaching there, turn left." },
      { original: "वहाँ पहुँचकर, पुल पार करें।", translation: "After reaching there, Cross the bridge." },
      { original: "वहाँ पहुँचकर,", translation: "Invented direction." },
    ]) expect(findEvidenceSpan(transcript, { ...evidence, startSec: null })).toBeNull();
  });
  it("enforces independent source ordering and preserves unavailable timestamps", () => {
    const evidence = { original: "बाएँ मुड़ें।", translation: "turn left.", startSec: null };
    const span = findEvidenceSpan(transcript, evidence);
    if (!span) throw new Error("Missing span");
    expect(findEvidenceSpan(transcript, evidence, span.originalEnd, span.translationEnd)).toBeNull();
    expect(findEvidenceSpan(transcript, { ...evidence, startSec: 30 })).toBeNull();
  });
  it("combines repeated transitions using their own occurrence, retaining both ordered actions", () => {
    const template = englishFixture.steps[0];
    if (!template) throw new Error("Missing fixture");
    const rows = [
      { original: "वहाँ पहुँचकर,", translation: "After reaching there,", direction: "arrive" as const },
      { original: "बाएँ मुड़ें।", translation: "turn left.", direction: "left" as const },
      { original: "वहाँ पहुँचकर,", translation: "After reaching there,", direction: "arrive" as const },
      { original: "दाएँ मुड़ें।", translation: "turn right.", direction: "right" as const },
    ];
    const repeated = { original: rows.map(r => r.original).join(" "), translation: rows.map(r => r.translation).join(" "),
      segments: rows.map((r, i) => ({ id: "s" + i, original: r.original, translation: r.translation, startSec: null, endSec: null })) };
    const steps = rows.map((r, i) => ({ ...structuredClone(template), id: "step" + i, direction: r.direction, instruction: r.translation,
      landmark: { spoken: null, label: null }, evidence: { original: r.original, translation: r.translation, startSec: null } }));
    const result = refineNavigationSteps(steps, repeated);
    expect(result.steps.map(step => step.instruction)).toEqual(["After reaching there, turn left.", "After reaching there, turn right."]);
    expect(result.steps.map(step => step.direction)).toEqual(["left", "right"]);
    const first = result.steps[0]?.evidence; const second = result.steps[1]?.evidence;
    if (!first || !second) throw new Error("Missing combined evidence");
    const span = findEvidenceSpan(repeated, first);
    if (!span) throw new Error("Missing first occurrence");
    expect(findEvidenceSpan(repeated, second, span.originalEnd, span.translationEnd)).not.toBeNull();
  });
});
