"use client";

import { createContext, useContext, useReducer, type Dispatch, type ReactNode } from "react";

import { demoJourney, type LanguageCode } from "@/features/journey/fixtures";
import type { LensOutcome, Step, StepDraft } from "@/features/journey/schemas";

export type RecordingSource = "live" | "sample";

export type JourneyState = {
  language: LanguageCode;
  recording: { durationSec: number; source: RecordingSource } | null;
  steps: Step[];
  routeConfirmed: boolean;
  currentStep: number;
  arrived: boolean;
  lensChecks: Record<string, LensOutcome>;
};

export type JourneyAction =
  | { type: "language/set"; language: LanguageCode }
  | { type: "recording/saved"; durationSec: number; source: RecordingSource }
  | { type: "step/updated"; id: string; draft: StepDraft }
  | { type: "step/moved"; id: string; offset: -1 | 1 }
  | { type: "step/removed"; id: string }
  | { type: "step/added"; step: Step }
  | { type: "step/reviewed"; id: string }
  | { type: "route/confirmed" }
  | { type: "guide/moved"; index: number }
  | { type: "guide/arrived"; arrived: boolean }
  | { type: "lens/checked"; stepId: string; outcome: LensOutcome }
  | { type: "journey/reset" };

/** Every screen works on its own: the state starts from the demo journey, not from empty. */
export function createInitialState(): JourneyState {
  return {
    language: "auto",
    recording: null,
    steps: demoJourney.steps.map((step) => ({ ...step })),
    routeConfirmed: false,
    currentStep: 0,
    arrived: false,
    lensChecks: {},
  };
}

const clampIndex = (index: number, length: number) => Math.min(Math.max(0, index), Math.max(0, length - 1));

export function journeyReducer(state: JourneyState, action: JourneyAction): JourneyState {
  switch (action.type) {
    case "language/set":
      return { ...state, language: action.language };
    case "recording/saved":
      return { ...state, recording: { durationSec: action.durationSec, source: action.source } };
    case "step/updated":
      return {
        ...state,
        steps: state.steps.map((step) => (step.id === action.id ? { ...step, ...action.draft, reviewed: true } : step)),
      };
    case "step/moved": {
      const from = state.steps.findIndex((step) => step.id === action.id);
      const to = from + action.offset;
      const moving = state.steps[from];
      if (from < 0 || to < 0 || to >= state.steps.length || !moving) return state;
      const steps = state.steps.filter((step) => step.id !== action.id);
      steps.splice(to, 0, moving);
      return { ...state, steps };
    }
    case "step/removed": {
      if (state.steps.length <= 1) return state;
      const steps = state.steps.filter((step) => step.id !== action.id);
      return { ...state, steps, currentStep: clampIndex(state.currentStep, steps.length) };
    }
    case "step/added":
      return { ...state, steps: [...state.steps, action.step] };
    case "step/reviewed":
      return { ...state, steps: state.steps.map((step) => (step.id === action.id ? { ...step, reviewed: true } : step)) };
    case "route/confirmed":
      return { ...state, routeConfirmed: true, currentStep: 0, arrived: false };
    case "guide/moved":
      return { ...state, currentStep: clampIndex(action.index, state.steps.length), arrived: false };
    case "guide/arrived":
      return { ...state, arrived: action.arrived };
    case "lens/checked":
      return { ...state, lensChecks: { ...state.lensChecks, [action.stepId]: action.outcome } };
    case "journey/reset":
      return createInitialState();
  }
}

/** Steps whose uncertainty the traveler hasn't resolved yet. */
export function unresolvedSteps(steps: ReadonlyArray<Step>): Step[] {
  return steps.filter((step) => step.confidence !== "high" && !step.reviewed);
}

const JourneyContext = createContext<{ state: JourneyState; dispatch: Dispatch<JourneyAction> } | null>(null);

/** In-memory journey state for the flow. Persistence arrives with the backend phases. */
export function JourneyProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(journeyReducer, undefined, createInitialState);
  return <JourneyContext value={{ state, dispatch }}>{children}</JourneyContext>;
}

export function useJourney() {
  const context = useContext(JourneyContext);
  if (!context) throw new Error("useJourney must be used inside JourneyProvider.");
  return context;
}
