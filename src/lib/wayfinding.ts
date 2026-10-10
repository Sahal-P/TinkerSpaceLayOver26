/** Wayfinding vocabulary shared by UI components and the journey schemas. */

export const DIRECTIONS = ["start", "straight", "left", "right", "uphill", "arrive"] as const;
export type Direction = (typeof DIRECTIONS)[number];

export const directionLabels: Record<Direction, string> = {
  start: "Start here",
  straight: "Go straight",
  left: "Turn left",
  right: "Turn right",
  uphill: "Head uphill",
  arrive: "Arrive",
};

export const CONFIDENCE_LEVELS = ["high", "medium", "low"] as const;
export type Confidence = (typeof CONFIDENCE_LEVELS)[number];

export type Tone = "neutral" | "accent" | "positive" | "caution" | "critical";

export const confidenceCopy: Record<Confidence, { label: string; description: string; tone: Tone }> = {
  high: { label: "Clear", description: "The speaker was specific.", tone: "positive" },
  medium: { label: "Check this", description: "Some details were vague.", tone: "caution" },
  low: { label: "Unsure", description: "The audio or wording was ambiguous.", tone: "critical" },
};
