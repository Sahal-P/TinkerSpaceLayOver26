import { describe, expect, it, vi } from "vitest";
import { englishFixture } from "@/contracts/fixtures";
import { modelFixture } from "@/server/testing/model-fixtures";
import { assembleDraft } from "./pipeline";
import { rejectedOutput } from "./diagnostics";

describe("content-free extraction diagnostics", () => {
  it("never includes arbitrary values or unknown schema field names", () => {
    const sink = vi.fn(); const error = rejectedOutput("invalid_structure", "extraction", ["steps", 2, "private-key-value", Symbol("private")], sink);
    expect(sink).toHaveBeenCalledWith({ stage: "extraction", reason: "invalid_structure", path: ["steps", 2, "field", "field"] });
    expect(JSON.stringify(sink.mock.calls)).not.toContain("private");
    expect(error).toMatchObject({ code: "invalid_model_output", status: 502, retryable: true });
  });
  it.each([
    ["quote_mismatch", { instruction: "Invented private instruction" }],
    ["unsupported_direction", { direction: "right" }],
    ["unsupported_incline", { incline: "down" }],
    ["landmark_mismatch", { landmark: { spoken: "private landmark", label: "private landmark" } }],
    ["distance_mismatch", { distance: { spoken: "private distance", translation: "private distance" } }],
  ])("distinguishes %s without exposing source content", (reason, change) => {
    const model = modelFixture(englishFixture); Object.assign(model.extraction.steps[0] ?? {}, change);
    const sink = vi.fn(); expect(() => assembleDraft(model.transcription, model.extraction, sink)).toThrow();
    expect(sink).toHaveBeenCalledWith(expect.objectContaining({ reason, stage: "assembly" }));
    expect(JSON.stringify(sink.mock.calls)).not.toContain("private");
  });
  it("identifies evidence ordering without logging the mismatched quote", () => {
    const model = modelFixture(englishFixture); model.extraction.steps.reverse(); const sink = vi.fn();
    expect(() => assembleDraft(model.transcription, model.extraction, sink)).toThrow();
    expect(sink).toHaveBeenCalledWith(expect.objectContaining({ reason: "evidence_ordering" }));
  });
});
