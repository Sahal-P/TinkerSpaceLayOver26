"use client";

import { ArrowRight, Plus } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button, arrowNudge } from "@/components/ui/button";
import { ChoiceChips } from "@/components/ui/choice-chips";
import { Container } from "@/components/ui/container";
import { ActionBar } from "@/features/journey/components/flow/action-bar";
import { ScreenIntro } from "@/features/journey/components/flow/screen-intro";
import { StepEditor } from "@/features/journey/components/review/step-editor";
import { TranscriptPanel } from "@/features/journey/components/review/transcript-panel";
import { demoJourney } from "@/features/journey/fixtures";
import { unresolvedSteps, useJourney } from "@/features/journey/journey-store";
import type { Step } from "@/features/journey/schemas";
import { formatDistance } from "@/lib/format";
import { spring } from "@/lib/motion";
import { cn } from "@/lib/utils";

type Tab = "steps" | "transcript";

const tabs = [
  { value: "steps", label: "Steps" },
  { value: "transcript", label: "Transcript" },
] as const;

function newStep(): Step {
  return {
    id: `step-${crypto.randomUUID()}`,
    anchor: null,
    direction: "straight",
    instruction: "",
    landmark: "",
    distanceM: 50,
    original: "",
    confidence: "high",
    lookFor: "",
    reviewed: true,
  };
}

export function ReviewScreen() {
  const router = useRouter();
  const { state, dispatch } = useJourney();
  const [tab, setTab] = useState<Tab>("steps");
  const [freshId, setFreshId] = useState<string | null>(null);
  const unresolved = unresolvedSteps(state.steps);
  const meters = state.steps.reduce((sum, step) => sum + step.distanceM, 0);

  const addStep = () => {
    const step = newStep();
    dispatch({ type: "step/added", step });
    setFreshId(step.id);
  };

  const confirm = () => {
    dispatch({ type: "route/confirmed" });
    router.push("/guide");
  };

  return (
    <Container size="xl" className="flex-1 py-8 sm:py-12 lg:py-16">
      <ScreenIntro
        title="Check the route before you go."
      >
        {state.steps.length} steps · {formatDistance(meters)} ·{" "}
        {unresolved.length ? `${unresolved.length} flagged for a second look` : "nothing flagged"}
      </ScreenIntro>

      <ChoiceChips name="review-tab" legend="Show" options={tabs} value={tab} onChange={setTab} className="mt-8 lg:hidden" />

      <div className="mt-8 grid gap-10 lg:mt-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-start lg:gap-14">
        <section aria-labelledby="steps-title" className={cn(tab !== "steps" && "hidden lg:block")}>
          <h2 id="steps-title" className="sr-only">
            Steps
          </h2>
          <ol className="border-y border-line">
            <AnimatePresence initial={false}>
              {state.steps.map((step, index) => (
                <motion.li
                  key={step.id}
                  layout
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={spring.soft}
                  className="overflow-hidden border-b border-line last:border-b-0"
                >
                  <StepEditor
                    step={step}
                    index={index}
                    total={state.steps.length}
                    sourceLanguage={demoJourney.sourceLanguage.code}
                    initiallyEditing={step.id === freshId}
                    onSave={(draft) => dispatch({ type: "step/updated", id: step.id, draft })}
                    onCancelNew={() => dispatch({ type: "step/removed", id: step.id })}
                    onMove={(offset) => dispatch({ type: "step/moved", id: step.id, offset })}
                    onRemove={() => dispatch({ type: "step/removed", id: step.id })}
                    onReviewed={() => dispatch({ type: "step/reviewed", id: step.id })}
                  />
                </motion.li>
              ))}
            </AnimatePresence>
          </ol>
          <Button variant="secondary" className="mt-6" onClick={addStep}>
            <Plus aria-hidden className="size-4" />
            Add a step
          </Button>
        </section>

        <div className={cn("lg:sticky lg:top-36", tab !== "transcript" && "hidden lg:block")}>
          <TranscriptPanel />
        </div>
      </div>

      <ActionBar
        note={
          unresolved.length
            ? `${unresolved.length} unresolved ${unresolved.length === 1 ? "step stays" : "steps stay"} flagged in the guide.`
            : "Every step is clear or checked."
        }
      >
        <Button size="lg" onClick={confirm}>
          {unresolved.length ? "Confirm anyway" : "Confirm route"}
          <ArrowRight aria-hidden className={cn("size-5", arrowNudge)} />
        </Button>
      </ActionBar>
    </Container>
  );
}
