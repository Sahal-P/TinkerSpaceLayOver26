import { describe, expect, it } from "vitest";
import { ambiguousFixture, englishFixture } from "@/contracts/fixtures";
import { guideDraftSchema } from "@/contracts/guide";
import {
  createInitialState,
  journeyReducer,
  unresolvedSteps,
} from "./journey-store";
import { presentStep } from "./presentation";
const demo = () =>
  journeyReducer(createInitialState(), { type: "demo/loaded" });

describe("canonical journey reducer", () => {
  it("starts empty/live and requires explicit demo selection", () => {
    expect(createInitialState()).toMatchObject({
      mode: "live",
      draft: null,
      clip: null,
    });
    expect(demo().draft?.steps).toHaveLength(6);
  });
  it("preserves uncertainty after review and bulk confirmation", () => {
    let state = {
      ...createInitialState(),
      draft: structuredClone(ambiguousFixture),
    };
    const id = state.draft.steps[0]?.id ?? "";
    state = {
      ...state,
      ...journeyReducer(state, { type: "step/reviewed", id }),
      draft:
        journeyReducer(state, { type: "step/reviewed", id }).draft ??
        state.draft,
    };
    expect(
      unresolvedSteps(
        state.draft.steps.map((step, index) => presentStep(step, index)),
      ),
    ).toHaveLength(1);
    expect(
      journeyReducer(state, {
        type: "route/confirmed",
        acknowledgeWarnings: false,
      }).routeConfirmed,
    ).toBe(false);
    const confirmed = journeyReducer(state, {
      type: "route/confirmed",
      acknowledgeWarnings: true,
    });
    expect(confirmed.routeConfirmed).toBe(true);
    expect(confirmed.draft?.steps[0]).toMatchObject({
      reviewed: true,
      confidence: "low",
      needsReview: true,
    });
  });
  it("changes edit/reorder provenance and retains warning state", () => {
    const state = demo();
    const step = state.draft?.steps[1];
    if (!step) throw new Error("Missing step");
    const changed = journeyReducer(state, {
      type: "step/updated",
      id: step.id,
      draft: {
        instruction: "Walk straight",
        landmark: null,
        distanceM: null,
        direction: "straight",
        incline: null,
      },
    });
    expect(changed.draft?.steps[1]).toMatchObject({
      source: "user",
      evidence: null,
      reviewed: false,
      landmark: { label: null },
      distance: { meters: null },
    });
    const moved = journeyReducer(state, {
      type: "step/moved",
      id: step.id,
      offset: -1,
    });
    expect(moved.draft?.steps[0]).toMatchObject({
      id: step.id,
      source: "user",
      evidence: null,
    });
    expect(guideDraftSchema.safeParse(moved.draft).success).toBe(true);
  });
  it("does not convert an unchanged form to user evidence", () => {
    const state = demo();
    const step = state.draft?.steps[1];
    if (!step) throw new Error("Missing step");
    const updated = journeyReducer(state, {
      type: "step/updated",
      id: step.id,
      draft: {
        instruction: step.instruction,
        landmark: step.landmark.label,
        direction: step.direction,
        incline: step.incline,
        distanceM: step.distance.meters,
      },
    });
    expect(updated.draft?.steps[1]?.source).toBe("audio");
  });
  it("refuses invalid added steps and preserves missing values in valid ones", () => {
    const state = demo();
    const added = journeyReducer(state, {
      type: "step/added",
      id: "new",
      draft: {
        instruction: "",
        landmark: null,
        distanceM: null,
        direction: "unknown",
        incline: null,
      },
    });
    expect(added).toBe(state);
    const valid = journeyReducer(state, {
      type: "step/added",
      id: "new",
      draft: {
        instruction: "Ask the speaker",
        landmark: null,
        distanceM: null,
        direction: "unknown",
        incline: null,
      },
    });
    expect(valid.draft?.steps.at(-1)).toMatchObject({
      confidence: "low",
      needsReview: true,
      distance: { meters: null },
      source: "user",
    });
  });
  it("ignores stale extraction callbacks, clears audio on success, and never falls back to demo", () => {
    let state = journeyReducer(createInitialState(), {
      type: "extraction/started",
      attemptId: "a",
    });
    expect(
      journeyReducer(state, {
        type: "extraction/succeeded",
        attemptId: "old",
        guide: englishFixture,
        requestId: crypto.randomUUID(),
      }),
    ).toBe(state);
    state = journeyReducer(state, {
      type: "extraction/cancelled",
      attemptId: "a",
    });
    expect(
      journeyReducer(state, {
        type: "extraction/succeeded",
        attemptId: "a",
        guide: englishFixture,
        requestId: crypto.randomUUID(),
      }),
    ).toBe(state);
    state = journeyReducer(state, {
      type: "extraction/started",
      attemptId: "b",
    });
    state = journeyReducer(state, {
      type: "extraction/succeeded",
      attemptId: "b",
      guide: englishFixture,
      requestId: crypto.randomUUID(),
    });
    expect(state).toMatchObject({
      mode: "live",
      clip: null,
      draft: { version: 1 },
      routeConfirmed: false,
    });
  });
  it("refuses confirmation of corrupt drafts, never removes the last step, and clamps indices", () => {
    const state = demo();
    const first = state.draft?.steps[0];
    if (!state.draft || !first) throw new Error("Missing fixture");
    const corrupt = {
      ...state,
      draft: { ...state.draft, steps: [{ ...first, instruction: "" }] },
    };
    expect(
      journeyReducer(corrupt, {
        type: "route/confirmed",
        acknowledgeWarnings: true,
      }).routeConfirmed,
    ).toBe(false);
    const single = { ...state, draft: { ...state.draft, steps: [first] } };
    expect(journeyReducer(single, { type: "step/removed", id: first.id })).toBe(
      single,
    );
    expect(
      journeyReducer(single, { type: "guide/moved", index: 99 }).currentStep,
    ).toBe(0);
  });
});

describe("demo entry and consent", () => {
  it("preserves a requested landing stop after explicit demo review", () => {
    let state = journeyReducer(createInitialState(), {
      type: "demo/loaded",
      startIndex: 4,
    });
    state = journeyReducer(state, {
      type: "route/confirmed",
      acknowledgeWarnings: true,
    });
    expect(state.currentStep).toBe(4);
    expect(state.routeConfirmed).toBe(true);
  });
  it("stores consent revocation without losing the selected clip", () => {
    const state = { ...createInitialState(), consent: true };
    expect(
      journeyReducer(state, { type: "consent/set", consent: false }).consent,
    ).toBe(false);
  });
});
