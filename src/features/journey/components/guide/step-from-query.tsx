"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

import { useJourney } from "@/features/journey/journey-store";

/** Opens the guide at `?step=N` (1-based), as linked from the landing page's photo cards. */
export function StepFromQuery() {
  const step = Number(useSearchParams().get("step"));
  const { dispatch } = useJourney();

  useEffect(() => {
    // The reducer clamps the index to the steps that exist.
    if (Number.isInteger(step) && step >= 1) dispatch({ type: "guide/moved", index: step - 1 });
  }, [step, dispatch]);

  return null;
}
