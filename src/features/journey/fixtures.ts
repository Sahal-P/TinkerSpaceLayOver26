import { lisbonDemoFixture } from "@/contracts/fixtures";
import type { LensOutcome, LensScenario, Step } from "./schemas";

/** Explicit demo only. Never used as a fallback for a live request. */
export const demoDraft = lisbonDemoFixture;
export const demoJourney = {
  id: "lisbon-english-demo",
  title: "Tram stop to viewpoint",
  area: "Alfama",
  city: "Lisbon · scripted demo",
  from: "Yellow tram stop",
  to: "Viewpoint",
  speaker: { name: "Demo speaker", role: "reads a scripted example" },
  sourceLanguage: { code: "en", label: "English" },
  targetLanguage: { code: "en", label: "English" },
  recordedAt: "2026-10-10T09:24:00.000Z",
  durationSec: 12,
};
export const processingStages = [
  { id: "transcribe", label: "Transcription", detail: "The original words" },
  { id: "translate", label: "Translation", detail: "Into English" },
  { id: "landmarks", label: "Landmarks", detail: "Only what was spoken" },
  {
    id: "route",
    label: "Directions",
    detail: "Ordered steps with uncertainty",
  },
] as const;
export const languageOptions = [
  { value: "auto", label: "Auto / mixed" },
  { value: "ml", label: "മലയാളം", lang: "ml" },
  { value: "hi", label: "हिन्दी", lang: "hi" },
  { value: "en", label: "English", lang: "en" },
] as const;
export type LanguageCode = (typeof languageOptions)[number]["value"];

export const lensScenarios = [
  { id: "clear", label: "Clear view", outcome: "match", score: 0.92 },
  { id: "partial", label: "Partial view", outcome: "unsure", score: 0.58 },
  { id: "wrong", label: "Wrong street", outcome: "mismatch", score: 0.21 },
] satisfies LensScenario[];

export type LensVerdict = {
  outcome: LensOutcome;
  score: number;
  headline: string;
  detail: string;
  checks: Array<{ label: string; status: "pass" | "unknown" | "fail" }>;
};

/** Mock comparison copy for a scenario and step. */
export function lensVerdict(scenario: LensScenario, step: Step): LensVerdict {
  const name = (step.landmark ?? "unnamed landmark").toLowerCase();
  if (scenario.outcome === "match") {
    return {
      outcome: "match",
      score: scenario.score,
      headline: "Looks like the right place.",
      detail: `This matches the ${name}: ${step.lookFor.charAt(0).toLowerCase()}${step.lookFor.slice(1)}`,
      checks: [
        { label: "Shape and layout", status: "pass" },
        { label: "Colors and materials", status: "pass" },
        { label: "Street sign", status: "unknown" },
      ],
    };
  }
  if (scenario.outcome === "unsure") {
    return {
      outcome: "unsure",
      score: scenario.score,
      headline: "Can't tell yet.",
      detail: `Some details match the ${name}, but too much is out of frame. Step back or walk a few meters on, then check again.`,
      checks: [
        { label: "Shape and layout", status: "pass" },
        { label: "Colors and materials", status: "unknown" },
        { label: "Surroundings", status: "unknown" },
      ],
    };
  }
  return {
    outcome: "mismatch",
    score: scenario.score,
    headline: "Probably not it.",
    detail: `Nothing here looks like the ${name}. It may be on the other side of the street, or a little further on.`,
    checks: [
      { label: "Shape and layout", status: "fail" },
      { label: "Colors and materials", status: "fail" },
      { label: "Surroundings", status: "pass" },
    ],
  };
}
