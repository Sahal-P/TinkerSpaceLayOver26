import { directionSchema, type Direction, type Step } from "@/contracts/guide";
export type { Direction } from "@/contracts/guide";
export const DIRECTIONS = directionSchema.options;
export type Confidence = Step["confidence"];
export const directionLabels: Record<Direction, string> = {
  start: "Start here",
  straight: "Go straight",
  slight_left: "Bear slightly left",
  left: "Turn left",
  slight_right: "Bear slightly right",
  right: "Turn right",
  u_turn: "Make a U-turn",
  arrive: "Arrive",
  unknown: "Direction unclear",
};
export type Tone = "neutral" | "accent" | "positive" | "caution" | "critical";

export const confidenceCopy: Record<
  Confidence,
  { label: string; description: string; tone: Tone }
> = {
  high: {
    label: "Clear",
    description: "The speaker was specific.",
    tone: "positive",
  },
  medium: {
    label: "Check this",
    description: "Some details were vague.",
    tone: "caution",
  },
  low: {
    label: "Unsure",
    description: "The audio or wording was ambiguous.",
    tone: "critical",
  },
};
