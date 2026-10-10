import type { z } from "zod";

import type {
  LensOutcome,
  LensScenario,
  Step,
  journeySchema,
  lensScenarioSchema,
  processingStageSchema,
} from "@/features/journey/schemas";

/*
 * Mock data for the UI-first phase. Shapes match the Zod schemas (checked in
 * fixtures.test.ts) so later phases can swap in real Gemini output unchanged.
 */

export const demoJourney = {
  id: "alfama-miradouro",
  title: "From the tram stop to the miradouro",
  area: "Alfama",
  city: "Lisbon",
  from: "Tram 28 stop",
  to: "Miradouro de Santa Luzia",
  speaker: { name: "Dona Amélia", role: "runs the café on the corner" },
  sourceLanguage: { code: "pt-PT", label: "Portuguese (Portugal)" },
  targetLanguage: { code: "en", label: "English" },
  recordedAt: "2026-10-10T09:24:00.000Z",
  durationSec: 47,
  transcript: [
    {
      id: "s1",
      startSec: 0,
      original: "Olhe, começa aqui na paragem do elétrico amarelo e vire-se para cima.",
      translation: "Look, start here at the yellow tram stop and face uphill.",
      highlights: [{ original: "paragem do elétrico amarelo", translation: "yellow tram stop" }],
    },
    {
      id: "s2",
      startSec: 7,
      original: "Sobe a rua e passa a pastelaria com os azulejos azuis. Cheira a canela, não tem como falhar.",
      translation: "Walk up the street past the bakery with the blue tiles. It smells of cinnamon, you can't miss it.",
      highlights: [{ original: "pastelaria com os azulejos azuis", translation: "bakery with the blue tiles" }],
    },
    {
      id: "s3",
      startSec: 16,
      original: "Depois passa pelo arco de pedra… acho que é à direita.",
      translation: "Then go through the stone archway… I think it's on the right.",
      highlights: [{ original: "arco de pedra", translation: "stone archway" }],
    },
    {
      id: "s4",
      startSec: 23,
      original: "Na igreja pequena com a torre do sino, vira à esquerda.",
      translation: "At the little church with the bell tower, turn left.",
      highlights: [{ original: "igreja pequena com a torre do sino", translation: "little church with the bell tower" }],
    },
    {
      id: "s5",
      startSec: 30,
      original: "Sobe as escadas ao lado da muralha do castelo. É a segunda escadaria, não a primeira… ou a primeira, já não sei.",
      translation: "Climb the steps beside the castle wall. It's the second staircase, not the first… or the first, I'm not sure anymore.",
      highlights: [{ original: "muralha do castelo", translation: "castle wall" }],
    },
    {
      id: "s6",
      startSec: 41,
      original: "E chega ao miradouro, com o quiosque azul. Já está!",
      translation: "And you reach the viewpoint with the blue kiosk. That's it!",
      highlights: [{ original: "miradouro, com o quiosque azul", translation: "viewpoint with the blue kiosk" }],
    },
  ],
  steps: [
    {
      id: "step-tram",
      anchor: "tram",
      direction: "start",
      instruction: "Start at the yellow tram stop and face uphill.",
      landmark: "Yellow tram stop",
      distanceM: 0,
      original: "Começa aqui na paragem do elétrico amarelo e vire-se para cima.",
      confidence: "high",
      lookFor: "A yellow tram at a shelter, with rails running uphill.",
      reviewed: false,
    },
    {
      id: "step-bakery",
      anchor: "bakery",
      direction: "straight",
      instruction: "Walk up the street past the bakery with blue tiles.",
      landmark: "Bakery with blue tiles",
      distanceM: 120,
      original: "Sobe a rua e passa a pastelaria com os azulejos azuis.",
      confidence: "high",
      lookFor: "A shopfront covered in blue azulejo tiles, under a terracotta awning.",
      reviewed: false,
    },
    {
      id: "step-archway",
      anchor: "archway",
      direction: "right",
      instruction: "Go through the old stone archway on your right.",
      landmark: "Stone archway",
      distanceM: 80,
      original: "Depois passa pelo arco de pedra… acho que é à direita.",
      confidence: "medium",
      note: "She said “I think it's on the right”, so the side is a guess.",
      lookFor: "A rounded stone arch, just wide enough for one car.",
      reviewed: false,
    },
    {
      id: "step-church",
      anchor: "church",
      direction: "left",
      instruction: "Turn left at the little church with the bell tower.",
      landmark: "Church with the bell tower",
      distanceM: 150,
      original: "Na igreja pequena com a torre do sino, vira à esquerda.",
      confidence: "high",
      lookFor: "A small white church with its bell tower on the left, under a pointed terracotta roof.",
      reviewed: false,
    },
    {
      id: "step-castle",
      anchor: "castle",
      direction: "uphill",
      instruction: "Climb the steps beside the castle wall. Take the second staircase.",
      landmark: "Castle wall staircase",
      distanceM: 200,
      original: "Sobe as escadas ao lado da muralha do castelo. É a segunda escadaria… ou a primeira, já não sei.",
      confidence: "low",
      note: "She changed her mind between the first and the second staircase.",
      lookFor: "Stone steps climbing along a crenellated castle wall.",
      reviewed: false,
    },
    {
      id: "step-miradouro",
      anchor: "miradouro",
      direction: "arrive",
      instruction: "Arrive at the viewpoint with the blue kiosk.",
      landmark: "Miradouro with the blue kiosk",
      distanceM: 100,
      original: "E chega ao miradouro, com o quiosque azul.",
      confidence: "high",
      lookFor: "An open terrace with a railing, river views and a small blue kiosk.",
      reviewed: false,
    },
  ],
} satisfies z.input<typeof journeySchema>;

export const processingStages = [
  { id: "transcribe", label: "Transcribing", detail: "Listening to 0:47 of Portuguese (Portugal)", durationMs: 2600 },
  { id: "translate", label: "Translating", detail: "Into English, keeping street and place names", durationMs: 2200 },
  { id: "landmarks", label: "Finding landmarks", detail: "6 landmarks, 2 worth a second look", durationMs: 2400 },
  { id: "route", label: "Building your route", detail: "650 m, about 9 minutes on foot", durationMs: 2200 },
] satisfies Array<z.input<typeof processingStageSchema>>;

export const languageOptions = [
  { value: "auto", label: "Auto-detect" },
  { value: "pt", label: "Português", lang: "pt" },
  { value: "es", label: "Español", lang: "es" },
  { value: "fr", label: "Français", lang: "fr" },
  { value: "ja", label: "日本語", lang: "ja" },
] as const;

export type LanguageCode = (typeof languageOptions)[number]["value"];

export const lensScenarios = [
  { id: "clear", label: "Clear view", outcome: "match", score: 0.92 },
  { id: "partial", label: "Partial view", outcome: "unsure", score: 0.58 },
  { id: "wrong", label: "Wrong street", outcome: "mismatch", score: 0.21 },
] satisfies Array<z.input<typeof lensScenarioSchema>>;

export type LensVerdict = {
  outcome: LensOutcome;
  score: number;
  headline: string;
  detail: string;
  checks: Array<{ label: string; status: "pass" | "unknown" | "fail" }>;
};

/** Mock comparison copy for a scenario and step. */
export function lensVerdict(scenario: LensScenario, step: Step): LensVerdict {
  const name = step.landmark.toLowerCase();
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
