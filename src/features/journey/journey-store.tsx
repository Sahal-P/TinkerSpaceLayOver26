"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type Dispatch,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import {
  guideDraftSchema,
  reviewedGuideSchema,
  stepSchema,
  MAX_STEPS,
  type GuideDraft,
  type Step as CanonicalStep,
} from "@/contracts/guide";
import { resetSpeechCache } from "./speech-client";
import { demoDraft, type LanguageCode } from "./fixtures";
import type { LensOutcome, Step, StepDraft } from "./schemas";
import { presentStep } from "./presentation";
import type { AudioClip } from "./audio-client";
import {
  ExtractionError,
  submitExtraction,
  type ExtractionFailure,
} from "./extraction-client";

export type JourneyState = {
  mode: "live" | "demo";
  language: LanguageCode;
  clip: AudioClip | null;
  consent: boolean;
  draft: GuideDraft | null;
  routeConfirmed: boolean;
  currentStep: number;
  arrived: boolean;
  lensChecks: Record<string, LensOutcome>;
  extraction: {
    status: "idle" | "uploading" | "processing" | "success" | "error";
    attemptId: string | null;
    progress: number;
    error: ExtractionFailure | null;
    requestId: string | null;
  };
};
export type JourneyAction =
  | { type: "language/set"; language: LanguageCode }
  | { type: "consent/set"; consent: boolean }
  | { type: "clip/set"; clip: AudioClip; consent: boolean }
  | { type: "clip/clear" }
  | { type: "extraction/started"; attemptId: string }
  | { type: "extraction/progress"; attemptId: string; progress: number }
  | {
      type: "extraction/succeeded";
      attemptId: string;
      guide: GuideDraft;
      requestId: string;
    }
  | { type: "extraction/failed"; attemptId: string; error: ExtractionFailure }
  | { type: "extraction/cancelled"; attemptId: string }
  | { type: "demo/loaded"; startIndex?: number }
  | { type: "step/updated"; id: string; draft: StepDraft }
  | { type: "step/moved"; id: string; offset: -1 | 1 }
  | { type: "step/removed"; id: string }
  | { type: "step/added"; id: string; draft: StepDraft }
  | { type: "step/reviewed"; id: string }
  | { type: "route/confirmed"; acknowledgeWarnings: boolean }
  | { type: "guide/moved"; index: number }
  | { type: "guide/arrived"; arrived: boolean }
  | { type: "lens/checked"; stepId: string; outcome: LensOutcome }
  | { type: "journey/reset" };
export function createInitialState(): JourneyState {
  return {
    mode: "live",
    language: "auto",
    clip: null,
    consent: false,
    draft: null,
    routeConfirmed: false,
    currentStep: 0,
    arrived: false,
    lensChecks: {},
    extraction: {
      status: "idle",
      attemptId: null,
      progress: 0,
      error: null,
      requestId: null,
    },
  };
}
const clampIndex = (index: number, length: number) =>
  Math.min(Math.max(0, index), Math.max(0, length - 1));
function withSteps(state: JourneyState, steps: CanonicalStep[]): JourneyState {
  if (!state.draft) return state;
  const parsed = guideDraftSchema.safeParse({
    ...state.draft,
    steps,
    needsReview:
      state.draft.needsReview ||
      state.draft.warnings.length > 0 ||
      steps.some((step) => step.needsReview),
  });
  return parsed.success
    ? {
        ...state,
        draft: parsed.data,
        routeConfirmed: false,
        currentStep: clampIndex(state.currentStep, steps.length),
        arrived: false,
        lensChecks: {},
      }
    : state;
}
export function correctedStep(
  step: CanonicalStep,
  fields: StepDraft,
): CanonicalStep {
  return {
    ...step,
    instruction: fields.instruction,
    direction: fields.direction,
    incline: fields.incline,
    landmark: { spoken: fields.landmark, label: fields.landmark },
    distance: {
      spoken:
        fields.distanceM === null ? null : String(fields.distanceM) + " meters",
      meters: fields.distanceM,
    },
    source: "user",
    evidence: null,
    reviewed: false,
    confidence: fields.direction === "unknown" ? "low" : step.confidence,
    warnings:
      fields.direction === "unknown" && step.warnings.length === 0
        ? ["The direction is unspecified; check it before following."]
        : step.warnings,
    needsReview: step.needsReview || fields.direction === "unknown",
  };
}
export function journeyReducer(
  state: JourneyState,
  action: JourneyAction,
): JourneyState {
  const steps = state.draft?.steps ?? [];
  switch (action.type) {
    case "language/set":
      return { ...state, language: action.language };
    case "consent/set":
      return { ...state, consent: action.consent };
    case "journey/reset":
      return createInitialState();
    case "clip/clear":
      return { ...createInitialState(), language: state.language };
    case "clip/set":
      return {
        ...createInitialState(),
        language: state.language,
        clip: action.clip,
        consent: action.consent,
      };
    case "demo/loaded":
      return {
        ...createInitialState(),
        mode: "demo",
        currentStep: clampIndex(action.startIndex ?? 0, demoDraft.steps.length),
        draft: structuredClone(demoDraft),
        extraction: { ...createInitialState().extraction, status: "success" },
      };
    case "extraction/started":
      return {
        ...state,
        draft: null,
        routeConfirmed: false,
        extraction: {
          status: "uploading",
          attemptId: action.attemptId,
          progress: 0,
          error: null,
          requestId: null,
        },
      };
    case "extraction/progress":
      return state.extraction.attemptId === action.attemptId
        ? {
            ...state,
            extraction: {
              ...state.extraction,
              progress: action.progress,
              status: action.progress >= 1 ? "processing" : "uploading",
            },
          }
        : state;
    case "extraction/succeeded": {
      if (state.extraction.attemptId !== action.attemptId) return state;
      const parsed = guideDraftSchema.safeParse(action.guide);
      if (!parsed.success) return state;
      return {
        ...state,
        clip: null,
        draft: parsed.data,
        currentStep: 0,
        arrived: false,
        lensChecks: {},
        extraction: {
          ...state.extraction,
          attemptId: null,
          progress: 1,
          status: "success",
          requestId: action.requestId,
        },
      };
    }
    case "extraction/failed":
      return state.extraction.attemptId === action.attemptId
        ? {
            ...state,
            extraction: {
              ...state.extraction,
              attemptId: null,
              status: "error",
              error: action.error,
            },
          }
        : state;
    case "extraction/cancelled":
      return state.extraction.attemptId === action.attemptId
        ? { ...state, extraction: createInitialState().extraction }
        : state;
    case "step/updated":
      return withSteps(
        state,
        steps.map((step) => {
          if (step.id !== action.id) return step;
          const current = {
            instruction: step.instruction,
            direction: step.direction,
            incline: step.incline,
            landmark: step.landmark.label,
            distanceM: step.distance.meters,
          };
          return Object.entries(current).every(
            ([key, value]) => value === action.draft[key as keyof StepDraft],
          )
            ? step
            : correctedStep(step, action.draft);
        }),
      );
    case "step/moved": {
      const from = steps.findIndex((step) => step.id === action.id);
      const to = from + action.offset;
      const moving = steps[from];
      if (from < 0 || to < 0 || to >= steps.length || !moving) return state;
      const reordered = steps.filter((step) => step.id !== action.id);
      reordered.splice(to, 0, {
        ...moving,
        source: "user",
        evidence: null,
        reviewed: false,
      });
      return withSteps(state, reordered);
    }
    case "step/removed":
      return steps.length <= 1
        ? state
        : withSteps(
            state,
            steps.filter((step) => step.id !== action.id),
          );
    case "step/added": {
      if (steps.length >= MAX_STEPS) return state;
      const base: CanonicalStep = {
        id: action.id,
        instruction: action.draft.instruction,
        direction: "unknown",
        incline: null,
        landmark: { spoken: null, label: null },
        distance: { spoken: null, meters: null },
        source: "user",
        evidence: null,
        confidence: "low",
        reviewed: false,
        needsReview: true,
        warnings: ["This step was added by you; verify its details."],
      };
      const parsed = stepSchema.safeParse(correctedStep(base, action.draft));
      return parsed.success ? withSteps(state, [...steps, parsed.data]) : state;
    }
    case "step/reviewed":
      return withSteps(
        state,
        steps.map((step) =>
          step.id === action.id ? { ...step, reviewed: true } : step,
        ),
      );
    case "route/confirmed": {
      if (
        !state.draft ||
        (state.draft.needsReview && !action.acknowledgeWarnings)
      )
        return state;
      const reviewed = reviewedGuideSchema.safeParse({
        ...state.draft,
        steps: steps.map((step) => ({ ...step, reviewed: true })),
      });
      return reviewed.success
        ? {
            ...state,
            draft: reviewed.data,
            routeConfirmed: true,
            currentStep:
              state.mode === "demo"
                ? clampIndex(state.currentStep, steps.length)
                : 0,
            arrived: false,
          }
        : state;
    }
    case "guide/moved":
      return {
        ...state,
        currentStep: clampIndex(action.index, steps.length),
        arrived: false,
      };
    case "guide/arrived":
      return { ...state, arrived: action.arrived };
    case "lens/checked":
      return state.mode === "demo"
        ? {
            ...state,
            lensChecks: {
              ...state.lensChecks,
              [action.stepId]: action.outcome,
            },
          }
        : state;
  }
}
/** Review never removes uncertainty. */
export function unresolvedSteps(steps: ReadonlyArray<Step>): Step[] {
  return steps.filter((step) => step.needsReview);
}
type JourneyContextValue = {
  state: JourneyState & { steps: Step[] };
  dispatch: Dispatch<JourneyAction>;
  startExtraction: (clip?: AudioClip, consent?: boolean) => boolean;
  cancelExtraction: () => void;
};
const JourneyContext = createContext<JourneyContextValue | null>(null);
export function JourneyProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(
    journeyReducer,
    undefined,
    createInitialState,
  );
  const active = useRef<{ controller: AbortController; id: string } | null>(
    null,
  );
  useEffect(() => {
    resetSpeechCache();
    return () => resetSpeechCache();
  }, [state.draft]);
  const pathname = usePathname();
  const previousPath = useRef(pathname);
  const cancelExtraction = () => {
    const pending = active.current;
    if (!pending) return;
    active.current = null;
    pending.controller.abort();
    dispatch({ type: "extraction/cancelled", attemptId: pending.id });
  };
  useEffect(() => {
    return () => {
      active.current?.controller.abort();
      active.current = null;
    };
  }, []);
  useEffect(() => {
    if (previousPath.current === "/processing" && pathname !== "/processing") {
      const pending = active.current;
      active.current = null;
      if (pending) {
        pending.controller.abort();
        dispatch({ type: "extraction/cancelled", attemptId: pending.id });
      }
    }
    previousPath.current = pathname;
  }, [pathname]);
  const startExtraction = (
    requestedClip = state.clip,
    requestedConsent = state.consent,
  ) => {
    if (
      active.current ||
      !requestedClip ||
      !requestedConsent ||
      (state.extraction.error?.retryAt ?? 0) > Date.now()
    )
      return false;
    const id = crypto.randomUUID();
    const controller = new AbortController();
    active.current = { id, controller };
    if (requestedClip !== state.clip)
      dispatch({
        type: "clip/set",
        clip: requestedClip,
        consent: requestedConsent,
      });
    dispatch({ type: "extraction/started", attemptId: id });
    void submitExtraction(
      requestedClip,
      state.language,
      requestedConsent,
      controller.signal,
      (progress) =>
        dispatch({ type: "extraction/progress", attemptId: id, progress }),
    )
      .then(({ guide, requestId }) => {
        if (active.current?.id === id)
          dispatch({
            type: "extraction/succeeded",
            attemptId: id,
            guide,
            requestId,
          });
      })
      .catch((error: unknown) => {
        if (active.current?.id !== id) return;
        const failure: ExtractionFailure =
          error instanceof ExtractionError
            ? error.failure
            : {
                code: "network_error",
                message: "Processing failed. Try again.",
                retryable: true,
                requestId: null,
                retryAt: null,
              };
        dispatch({ type: "extraction/failed", attemptId: id, error: failure });
      })
      .finally(() => {
        if (active.current?.id === id) active.current = null;
      });
    return true;
  };
  const steps = useMemo(
    () =>
      state.draft?.steps.map((step, index) =>
        presentStep(step, index, state.mode === "demo"),
      ) ?? [],
    [state.draft, state.mode],
  );
  return (
    <JourneyContext
      value={{
        state: { ...state, steps },
        dispatch,
        startExtraction,
        cancelExtraction,
      }}
    >
      {children}
    </JourneyContext>
  );
}
export function useJourney(): JourneyContextValue {
  const context = useContext(JourneyContext);
  if (!context)
    throw new Error("useJourney must be used inside JourneyProvider.");
  return context;
}
