import { guideDraftSchema, type GuideDraft, type Step } from "./guide";

/** Illustrative expected outputs, not claims of live speech recognition accuracy. */
const translations = [
  "Start at the bus stop.",
  "Go straight for two hundred meters past the tea shop.",
  "Turn left at the bridge.",
  "Arrive at the clinic.",
] as const;
const samples = {
  en: {
    original: [...translations],
    landmarks: ["bus stop", "tea shop", "bridge", "clinic"],
    distance: "two hundred meters",
  },
  hi: {
    original: [
      "बस स्टॉप से शुरू करें।",
      "चाय की दुकान के पास दो सौ मीटर सीधे चलें।",
      "पुल पर बाएँ मुड़ें।",
      "क्लिनिक पर पहुँचें।",
    ],
    landmarks: ["बस स्टॉप", "चाय की दुकान", "पुल", "क्लिनिक"],
    distance: "दो सौ मीटर",
  },
  ml: {
    original: [
      "ബസ് സ്റ്റോപ്പിൽ നിന്ന് തുടങ്ങുക.",
      "ചായക്കട കടന്ന് ഇരുനൂറ് മീറ്റർ നേരെ പോകുക.",
      "പാലത്തിൽ ഇടത്തോട്ട് തിരിയുക.",
      "ക്ലിനിക്കിൽ എത്തുക.",
    ],
    landmarks: ["ബസ് സ്റ്റോപ്പിൽ", "ചായക്കട", "പാലത്തിൽ", "ക്ലിനിക്കിൽ"],
    distance: "ഇരുനൂറ് മീറ്റർ",
  },
} as const;
function clearFixture(code: keyof typeof samples): GuideDraft {
  const sample = samples[code];
  const directions = ["start", "straight", "left", "arrive"] as const;
  const labels = ["bus stop", "tea shop", "bridge", "clinic"];
  const segments = sample.original.map((original, index) => ({
    id: "s" + (index + 1),
    original,
    translation: translations[index] ?? "",
    startSec: null,
    endSec: null,
  }));
  const steps = segments.map((segment, index) => ({
    id: "fixture-step-" + (index + 1),
    instruction: segment.translation,
    direction: directions[index] ?? "unknown",
    incline: null,
    landmark: {
      spoken: sample.landmarks[index] ?? null,
      label: labels[index] ?? null,
    },
    distance: {
      spoken: index === 1 ? sample.distance : null,
      meters: index === 1 ? 200 : null,
    },
    evidence: {
      original: segment.original,
      translation: segment.translation,
      startSec: null,
    },
    source: "audio",
    confidence: "high",
    warnings: [],
    needsReview: false,
    reviewed: false,
  }));
  return guideDraftSchema.parse({
    version: 1,
    title: "Bus stop to clinic",
    languages: { detected: [{ code, confidence: "high" }], target: "en" },
    transcript: {
      original: segments.map((s) => s.original).join(" "),
      translation: segments.map((s) => s.translation).join(" "),
      segments,
    },
    steps,
    warnings: [],
    needsReview: false,
  });
}
export const englishFixture = clearFixture("en");
export const hindiFixture = clearFixture("hi");
export const malayalamFixture = clearFixture("ml");
/** A complete action spanning adjacent segments, with its unresolved reference preserved. */
export const contextualHindiFixture = (() => {
  const guide = structuredClone(hindiFixture);
  const prefix = guide.transcript.segments[1]; const action = guide.transcript.segments[2]; const step = guide.steps[2];
  if (!prefix || !action || !step) throw new Error("Missing contextual fixture");
  prefix.original = "वहाँ पहुँचकर,"; prefix.translation = "After reaching there,";
  action.original = "पुल पर बाएँ मुड़ें और दो सौ मीटर चलें।";
  action.translation = "turn left at the bridge and walk two hundred meters.";
  guide.transcript.original = guide.transcript.segments.map(s => s.original).join(" ");
  guide.transcript.translation = guide.transcript.segments.map(s => s.translation).join(" ");
  guide.steps.splice(1, 2, { ...step, instruction: prefix.translation + " " + action.translation,
    evidence: { original: prefix.original + " " + action.original, translation: prefix.translation + " " + action.translation, startSec: null },
    distance: { spoken: "दो सौ मीटर", meters: 200 }, confidence: "low", needsReview: true,
    warnings: ["The place referred to as there is not named in this instruction; confirm it with the speaker."],
  });
  guide.needsReview = true;
  return guideDraftSchema.parse(guide);
})();
export const mixedLanguageFixture = (() => {
  const fixture = structuredClone(englishFixture);
  const originals = [
    samples.ml.original[0],
    samples.hi.original[1],
    samples.en.original[2],
    samples.en.original[3],
  ];
  fixture.languages.detected = [
    { code: "ml", confidence: "high" },
    { code: "hi", confidence: "high" },
    { code: "en", confidence: "high" },
  ];
  fixture.transcript.segments.forEach((segment, index) => {
    segment.original = originals[index] ?? segment.original;
  });
  fixture.transcript.original = fixture.transcript.segments
    .map((segment) => segment.original)
    .join(" ");
  fixture.steps.forEach((step, index) => {
    if (step.evidence)
      step.evidence.original = originals[index] ?? step.evidence.original;
    if (index === 0) step.landmark.spoken = samples.ml.landmarks[0];
    if (index === 1) {
      step.landmark.spoken = samples.hi.landmarks[1];
      step.distance.spoken = samples.hi.distance;
    }
  });
  return guideDraftSchema.parse(fixture);
})();
function uncertainFixture(
  instruction: string,
  changes: Partial<Step>,
  warnings: string[],
): GuideDraft {
  const step = {
    ...structuredClone(englishFixture.steps[2]),
    id: "fixture-uncertain",
    instruction,
    evidence: {
      original: instruction,
      translation: instruction,
      startSec: null,
    },
    ...changes,
  };
  return guideDraftSchema.parse({
    version: 1,
    languages: { detected: [{ code: "en", confidence: "high" }], target: "en" },
    transcript: {
      original: instruction,
      translation: instruction,
      segments: [
        {
          id: "s1",
          original: instruction,
          translation: instruction,
          startSec: null,
          endSec: null,
        },
      ],
    },
    steps: [step],
    warnings,
    needsReview: true,
  });
}
export const ambiguousFixture = uncertainFixture(
  "Turn left or turn right at the bridge, I am not sure.",
  {
    direction: "unknown",
    confidence: "low",
    needsReview: true,
    warnings: ["The speaker named contradictory turns."],
  },
  ["The starting point and destination are missing."],
);
export const vagueDistanceFixture = uncertainFixture(
  "Continue a little further to the tea shop.",
  {
    direction: "straight",
    landmark: { spoken: "tea shop", label: "tea shop" },
    distance: { spoken: "a little further", meters: null },
    confidence: "medium",
    needsReview: true,
    warnings: ["The distance is vague."],
  },
  ["The starting point and destination are missing."],
);
export const incompleteFixture = uncertainFixture(
  "Turn left at the bridge.",
  {},
  ["The starting point and destination are missing."],
);
export const guideFixtures = {
  english: englishFixture,
  hindi: hindiFixture,
  malayalam: malayalamFixture,
  mixed: mixedLanguageFixture,
  ambiguous: ambiguousFixture,
  vagueDistance: vagueDistanceFixture,
  incomplete: incompleteFixture,
} as const;

/** English script of the landing's Lisbon example; no recorded speech or distances are claimed. */
export const lisbonDemoFixture = (() => {
  const quotes = [
    "Start at the yellow tram stop and face uphill.",
    "Go straight uphill past the bakery with blue tiles.",
    "Go through the stone archway. I think it is on the right.",
    "Turn left at the little church with the bell tower.",
    "Climb the steps beside the castle wall. It is the second staircase, not the first, or the first; I am not sure.",
    "Arrive at the viewpoint with the blue kiosk.",
  ];
  const directions = [
    "start",
    "straight",
    "unknown",
    "left",
    "unknown",
    "arrive",
  ] as const;
  const landmarks = [
    "yellow tram stop",
    "bakery with blue tiles",
    "stone archway",
    "little church with the bell tower",
    "castle wall",
    "viewpoint with the blue kiosk",
  ];
  const segments = quotes.map((quote, index) => ({
    id: "demo-segment-" + index,
    original: quote,
    translation: quote,
    startSec: null,
    endSec: null,
  }));
  const steps: Step[] = quotes.map((quote, index) => {
    const uncertain = index === 2 || index === 4;
    return {
      id: "demo-step-" + index,
      instruction: quote,
      direction: directions[index] ?? "unknown",
      incline: index === 0 || index === 1 || index === 4 ? "up" : null,
      landmark: {
        spoken: landmarks[index] ?? null,
        label: landmarks[index] ?? null,
      },
      distance: { spoken: null, meters: null },
      source: "audio",
      evidence: { original: quote, translation: quote, startSec: null },
      confidence: uncertain ? "low" : "high",
      needsReview: uncertain,
      reviewed: false,
      warnings:
        index === 2
          ? [
              "The side of the archway is uncertain; no turn was explicitly stated.",
            ]
          : index === 4
            ? [
                "The staircase choice is contradictory; check it before following.",
              ]
            : [],
    };
  });
  return guideDraftSchema.parse({
    version: 1,
    title: "Tram stop to viewpoint — scripted demo",
    languages: { detected: [{ code: "en", confidence: "high" }], target: "en" },
    transcript: {
      original: quotes.join(" "),
      translation: quotes.join(" "),
      segments,
    },
    steps,
    warnings: ["This scripted example does not state numeric distances."],
    needsReview: true,
  });
})();
