"use client";
import { ArrowRight, Plus } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { reviewedGuideSchema, MAX_STEPS } from "@/contracts/guide";
import { Button, arrowNudge } from "@/components/ui/button";
import { ChoiceChips } from "@/components/ui/choice-chips";
import { Container } from "@/components/ui/container";
import { ActionBar } from "@/features/journey/components/flow/action-bar";
import { FlowEmpty } from "@/features/journey/components/flow/flow-empty";
import { ScreenIntro } from "@/features/journey/components/flow/screen-intro";
import {
  useJourney,
  journeyReducer,
  type JourneyAction,
} from "@/features/journey/journey-store";
import type { Step } from "@/features/journey/schemas";
import { spring } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { StepEditor } from "./step-editor";
import { TranscriptPanel } from "./transcript-panel";

type Tab = "steps" | "transcript";
const tabs = [
  { value: "steps", label: "Steps" },
  { value: "transcript", label: "Transcript" },
] as const;
export function ReviewScreen() {
  const router = useRouter();
  const { state, dispatch } = useJourney();
  const [tab, setTab] = useState<Tab>("steps");
  const [fresh, setFresh] = useState<Step | null>(null);
  const [editing, setEditing] = useState<string[]>([]);
  const [acknowledged, setAcknowledged] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const guide = state.draft;
  if (!guide) return <FlowEmpty />;
  const pending = fresh !== null || editing.length > 0;
  const changeEditing = (id: string, active: boolean) =>
    setEditing((ids) =>
      active ? [...new Set([...ids, id])] : ids.filter((item) => item !== id),
    );
  const applyEdit = (action: JourneyAction): boolean => {
    if (journeyReducer(state, action) === state) {
      setError(
        "This change would make the guide invalid or exceed its limits. Shorten the step or cancel the edit.",
      );
      return false;
    }
    dispatch(action);
    setAcknowledged(false);
    setError(null);
    return true;
  };
  const confirm = () => {
    if (pending || (guide.needsReview && !acknowledged)) return;
    const checked = reviewedGuideSchema.safeParse({
      ...guide,
      steps: guide.steps.map((step) => ({ ...step, reviewed: true })),
    });
    if (!checked.success) {
      setError(
        "The guide could not be validated. Check the edited fields and step count.",
      );
      return;
    }
    dispatch({ type: "route/confirmed", acknowledgeWarnings: acknowledged });
    router.push("/guide");
  };
  const add = () => {
    setFresh({
      id: crypto.randomUUID(),
      anchor: null,
      instruction: "",
      landmark: null,
      distanceM: null,
      distanceSpoken: null,
      original: "",
      confidence: "low",
      note: "User-added step",
      lookFor: "",
      reviewed: false,
      source: "user",
      direction: "unknown",
      incline: null,
      warnings: ["Verify this user-added step."],
      needsReview: true,
    });
  };
  const sourceLanguage =
    guide.languages.detected.length === 1
      ? (guide.languages.detected[0]?.code ?? "")
      : "";
  return (
    <Container size="xl" className="flex-1 py-8 sm:py-12 lg:py-16">
      <ScreenIntro title="Check the route before you go.">
        {state.steps.length} steps ·{" "}
        {guide.needsReview
          ? "uncertainty stays visible after review"
          : "review each instruction"}
        .{" "}
        {state.mode === "demo"
          ? "This is a scripted demo."
          : "This guide stays in memory for this visit."}
      </ScreenIntro>
      {guide.warnings.length ? (
        <div className="mt-6 rounded-card bg-caution-soft p-5">
          <p className="font-medium">Route warnings</p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            {guide.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <ChoiceChips
        name="review-tab"
        legend="Show"
        options={tabs}
        value={tab}
        onChange={setTab}
        className="mt-8 lg:hidden"
      />
      <div className="mt-8 grid gap-10 lg:mt-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-14">
        <section
          aria-label="Review steps"
          className={cn(tab !== "steps" && "hidden lg:block")}
        >
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
                  className="border-b border-line last:border-b-0"
                >
                  <StepEditor
                    step={step}
                    index={index}
                    total={state.steps.length}
                    sourceLanguage={sourceLanguage}
                    onSave={(draft) => {
                      return applyEdit({
                        type: "step/updated",
                        id: step.id,
                        draft,
                      });
                    }}
                    onMove={(offset) => {
                      dispatch({ type: "step/moved", id: step.id, offset });
                      setAcknowledged(false);
                    }}
                    onRemove={() => {
                      dispatch({ type: "step/removed", id: step.id });
                      changeEditing(step.id, false);
                      setAcknowledged(false);
                    }}
                    onReviewed={() =>
                      dispatch({ type: "step/reviewed", id: step.id })
                    }
                    onEditingChange={(active) => changeEditing(step.id, active)}
                  />
                </motion.li>
              ))}
            </AnimatePresence>
          </ol>
          {fresh ? (
            <StepEditor
              step={fresh}
              index={state.steps.length}
              total={state.steps.length + 1}
              sourceLanguage={sourceLanguage}
              initiallyEditing
              onSave={(draft) => {
                if (!applyEdit({ type: "step/added", id: fresh.id, draft }))
                  return false;
                setFresh(null);
                return true;
              }}
              onCancelNew={() => setFresh(null)}
              onMove={() => undefined}
              onRemove={() => setFresh(null)}
              onReviewed={() => undefined}
            />
          ) : null}
          <Button
            variant="ghost"
            className="mt-4"
            onClick={add}
            disabled={pending || state.steps.length >= MAX_STEPS}
          >
            <Plus aria-hidden className="size-4" />
            Add a step
          </Button>
        </section>
        <div className={cn(tab !== "transcript" && "hidden lg:block")}>
          <TranscriptPanel />
        </div>
      </div>
      {guide.needsReview ? (
        <label className="mt-8 flex cursor-pointer items-start gap-3 rounded-card bg-caution-soft p-5 text-sm">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(event) => setAcknowledged(event.target.checked)}
            className="mt-0.5 size-5 shrink-0 accent-accent-ink"
          />
          I reviewed the directions and acknowledge the remaining uncertainty.
          Warnings stay in the guide.
        </label>
      ) : null}
      {error ? (
        <p role="alert" className="mt-4">
          {error}
        </p>
      ) : null}
      <ActionBar
        note={
          pending
            ? "Save or cancel the open editor before confirming."
            : "Confirming reviews every step; it does not verify real-world accuracy."
        }
      >
        <Button
          size="lg"
          disabled={pending || (guide.needsReview && !acknowledged)}
          onClick={confirm}
        >
          {guide.needsReview ? "Confirm with warnings" : "Confirm route"}
          <ArrowRight aria-hidden className={cn("size-5", arrowNudge)} />
        </Button>
      </ActionBar>
    </Container>
  );
}
