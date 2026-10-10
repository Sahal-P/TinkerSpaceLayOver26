import { describe, expect, it } from "vitest";

import { createInitialState, journeyReducer, unresolvedSteps } from "./journey-store";

const initial = createInitialState();
const ids = (state = initial) => state.steps.map((step) => step.id);

describe("journeyReducer", () => {
  it("starts from the demo journey so every screen works on its own", () => {
    expect(initial.steps).toHaveLength(6);
    expect(initial.currentStep).toBe(0);
    expect(initial.recording).toBeNull();
  });

  it("marks an edited step as reviewed", () => {
    const id = "step-castle";
    const next = journeyReducer(initial, {
      type: "step/updated",
      id,
      draft: { instruction: "Take the second staircase.", landmark: "Castle stairs", direction: "uphill", distanceM: 180 },
    });
    expect(next.steps.find((step) => step.id === id)).toMatchObject({ instruction: "Take the second staircase.", reviewed: true });
  });

  it("moves steps and ignores moves past either end", () => {
    const moved = journeyReducer(initial, { type: "step/moved", id: "step-bakery", offset: -1 });
    expect(ids(moved).slice(0, 2)).toEqual(["step-bakery", "step-tram"]);
    expect(journeyReducer(initial, { type: "step/moved", id: "step-tram", offset: -1 })).toBe(initial);
  });

  it("never removes the last step and keeps the guide position in range", () => {
    let state = journeyReducer(initial, { type: "guide/moved", index: 5 });
    state = journeyReducer(state, { type: "step/removed", id: "step-miradouro" });
    expect(state.currentStep).toBe(4);

    let single = { ...initial, steps: initial.steps.slice(0, 1) };
    single = journeyReducer(single, { type: "step/removed", id: "step-tram" });
    expect(single.steps).toHaveLength(1);
  });

  it("tracks unresolved uncertainty until a step is reviewed", () => {
    expect(unresolvedSteps(initial.steps).map((step) => step.id)).toEqual(["step-archway", "step-castle"]);
    const reviewed = journeyReducer(initial, { type: "step/reviewed", id: "step-archway" });
    expect(unresolvedSteps(reviewed.steps).map((step) => step.id)).toEqual(["step-castle"]);
  });

  it("clamps guide moves and resets arrival", () => {
    let state = journeyReducer(initial, { type: "guide/arrived", arrived: true });
    state = journeyReducer(state, { type: "guide/moved", index: 99 });
    expect(state).toMatchObject({ currentStep: 5, arrived: false });
  });

  it("resets to a fresh demo journey", () => {
    const edited = journeyReducer(initial, { type: "step/removed", id: "step-tram" });
    expect(ids(journeyReducer(edited, { type: "journey/reset" }))).toEqual(ids());
  });
});
