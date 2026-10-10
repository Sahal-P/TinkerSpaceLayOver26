"use client";

import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  MapPin,
  RotateCcw,
  Share2,
} from "lucide-react";
import { AnimatePresence, motion, type Variants } from "motion/react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { ConfidenceBadge } from "@/components/confidence-badge";
import { DirectionIndicator } from "@/components/direction-indicator";
import { JourneyScene } from "@/components/scene/journey-scene";
import { Badge } from "@/components/ui/badge";
import { Button, arrowNudge, buttonStyles } from "@/components/ui/button";
import { FlowEmpty } from "@/features/journey/components/flow/flow-empty";
import {
  detectedLanguageLabel,
  formatGuideDistance,
} from "@/features/journey/presentation";
import { useJourney } from "@/features/journey/journey-store";
import type { LensOutcome } from "@/features/journey/schemas";
import { duration, ease, spring } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { directionLabels } from "@/lib/wayfinding";

const card: Variants = {
  enter: (direction: number) => ({ opacity: 0, x: direction * 48 }),
  center: {
    opacity: 1,
    x: 0,
    transition: { duration: duration.slow, ease: ease.outSoft },
  },
  exit: (direction: number) => ({
    opacity: 0,
    x: direction * -48,
    transition: { duration: duration.fast, ease: ease.outSoft },
  }),
};

const lensBadge: Record<
  LensOutcome,
  { tone: "positive" | "caution" | "critical"; label: string }
> = {
  match: { tone: "positive", label: "Lens: matched" },
  unsure: { tone: "caution", label: "Lens: unsure" },
  mismatch: { tone: "critical", label: "Lens: no match" },
};

export function GuideScreen() {
  const { state } = useJourney();
  if (!state.draft) return <FlowEmpty />;
  if (!state.routeConfirmed) return <FlowEmpty needsReview />;
  return <ActiveGuideScreen />;
}

function ActiveGuideScreen() {
  const { state, dispatch } = useJourney();
  const { steps, currentStep, arrived } = state;
  const step = steps[currentStep] ?? steps[0];
  const [heading, setHeading] = useState<1 | -1>(1);
  const last = steps.length - 1;
  const demo = state.mode === "demo";
  const guide = state.draft;
  const language = guide ? detectedLanguageLabel(guide) : "";
  const originalLanguage =
    guide?.languages.detected.length === 1
      ? guide.languages.detected[0]?.code
      : undefined;

  const go = useCallback(
    (index: number) => {
      if (index < 0 || index > last) return;
      setHeading(index >= currentStep ? 1 : -1);
      dispatch({ type: "guide/moved", index });
    },
    [currentStep, dispatch, last],
  );

  const next = useCallback(() => {
    if (currentStep >= last) dispatch({ type: "guide/arrived", arrived: true });
    else go(currentStep + 1);
  }, [currentStep, dispatch, go, last]);

  const previous = useCallback(() => go(currentStep - 1), [currentStep, go]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLElement &&
        event.target.closest("input, textarea, select, button, a")
      )
        return;
      if (event.key === "ArrowRight") next();
      if (event.key === "ArrowLeft") previous();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, previous]);

  if (!step) return null;
  const lens = state.lensChecks[step.id];
  const needsCheck = step.needsReview;

  return (
    <div className="flex flex-1 flex-col lg:grid lg:grid-cols-[minmax(0,1.45fr)_minmax(26rem,1fr)]">
      <div className="relative h-[44svh] min-h-72 lg:sticky lg:top-[5.5rem] lg:h-[calc(100dvh-5.5rem)] lg:p-4">
        <JourneyScene
          mode="guide"
          stops={steps.map((item) => item.anchor)}
          activeIndex={currentStep}
          onSelectStop={go}
          label={`Illustrative sequence, not a geographic map. Step ${currentStep + 1}: ${step.landmark ?? "landmark not specified"}.`}
          className="relative h-full w-full bg-surface-sunken lg:rounded-panel lg:ring-1 lg:ring-line"
        />
        <div className="caps pointer-events-none absolute top-4 left-4 flex items-center gap-2 rounded-full bg-surface-raised px-3 py-1.5 text-ink-muted shadow-soft lg:top-8 lg:left-8">
          <span aria-hidden className="size-1.5 rounded-full bg-accent" />
          {demo ? "Illustrative demo" : "Illustrative sequence · not a map"}
        </div>
      </div>

      <section
        aria-label="Step-by-step directions"
        className="relative z-10 -mt-8 flex flex-1 flex-col rounded-t-panel bg-surface px-gutter pt-6 pb-safe shadow-lifted lg:mt-0 lg:rounded-none lg:px-10 lg:pt-10 lg:shadow-none"
      >
        <div className="flex items-center justify-between gap-4">
          <p className="caps text-ink-muted">
            Step <span className="text-ink">{currentStep + 1}</span> of{" "}
            {steps.length}
          </p>
          <p className="caps text-ink-muted">
            {arrived ? "End of directions" : "Temporary guide"}
          </p>
        </div>
        <ol aria-hidden className="mt-3 flex gap-1">
          {steps.map((item, index) => (
            <li
              key={item.id}
              className="h-1 flex-1 overflow-hidden rounded-full bg-line"
            >
              <motion.span
                className="block h-full origin-left rounded-full bg-accent"
                initial={false}
                animate={{
                  scaleX:
                    arrived || index < currentStep
                      ? 1
                      : index === currentStep
                        ? 0.5
                        : 0,
                }}
                transition={spring.soft}
              />
            </li>
          ))}
        </ol>

        {guide?.warnings.length ? (
          <ul
            className="mt-6 space-y-2 rounded-card bg-caution-soft p-4 text-sm"
            aria-label="Route warnings"
          >
            {guide.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        ) : null}
        <div className="relative mt-8 flex-1">
          <AnimatePresence mode="wait" custom={heading} initial={false}>
            {arrived ? (
              <motion.div
                key="arrived"
                variants={card}
                custom={1}
                initial="enter"
                animate="center"
                exit="exit"
              >
                <span className="grid size-16 place-items-center rounded-full bg-accent text-on-accent">
                  <Check aria-hidden className="size-7" />
                </span>
                <h1 className="mt-6 font-display text-headline">
                  {step.direction === "arrive"
                    ? "Arrival step reached."
                    : "End of directions."}
                </h1>
                <p className="mt-4 text-lg text-ink-muted">
                  You reached the end of the {steps.length} reviewed
                  instructions. Check your surroundings; this guide does not
                  verify your location.
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link href="/share" className={buttonStyles({ size: "lg" })}>
                    <Share2 aria-hidden className="size-5" />
                    {demo ? "Demo share preview" : "Sharing coming later"}
                  </Link>
                  <Button variant="secondary" size="lg" onClick={() => go(0)}>
                    <RotateCcw aria-hidden className="size-4" />
                    Walk it again
                  </Button>
                </div>
              </motion.div>
            ) : (
              <motion.article
                key={step.id}
                variants={card}
                custom={heading}
                initial="enter"
                animate="center"
                exit="exit"
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.18}
                onDragEnd={(_, info) => {
                  if (info.offset.x < -72) next();
                  else if (info.offset.x > 72) previous();
                }}
                className="cursor-grab touch-pan-y active:cursor-grabbing"
                aria-labelledby="step-instruction"
              >
                <div className="flex items-center gap-5">
                  <DirectionIndicator
                    direction={step.direction}
                    incline={step.incline}
                  />
                  <div className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                    <p className="caps text-accent-ink">
                      {directionLabels[step.direction]}
                      {step.incline
                        ? ` · ${step.incline === "up" ? "Uphill" : "Downhill"}`
                        : ""}
                    </p>
                    <p className="mt-1 font-display text-5xl tabular-nums">
                      {step.distanceM !== null
                        ? formatGuideDistance(step.distanceM)
                        : step.distanceSpoken
                          ? "Not quantified"
                          : "Not stated"}
                    </p>
                  </div>
                </div>
                <h1
                  id="step-instruction"
                  className="mt-7 font-display text-title text-balance [overflow-wrap:anywhere]"
                >
                  {step.instruction}
                </h1>
                <p className="mt-3 flex items-center gap-2 text-ink-muted">
                  <MapPin aria-hidden className="size-4 shrink-0" />
                  {step.landmark ?? "Landmark not specified"}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <ConfidenceBadge
                    level={step.confidence}
                    reviewed={step.reviewed}
                  />
                  {lens ? (
                    <Badge tone={lensBadge[lens].tone}>
                      {lensBadge[lens].label}
                    </Badge>
                  ) : null}
                </div>
                {step.original ? (
                  <blockquote
                    lang={originalLanguage}
                    className="mt-6 border-l border-line-strong pl-4"
                  >
                    <p className="font-display text-ink-muted italic">
                      “{step.original}”
                    </p>
                    <footer className="caps mt-2 text-ink-muted">
                      Original words · {language}
                    </footer>
                  </blockquote>
                ) : null}
                {needsCheck ? (
                  <p
                    className={cn(
                      "mt-6 rounded-card p-4 text-sm",
                      step.confidence === "low"
                        ? "bg-critical-soft text-ink"
                        : "bg-caution-soft text-ink",
                    )}
                  >
                    <span
                      className={cn(
                        "font-medium",
                        step.confidence === "low"
                          ? "text-critical"
                          : "text-caution",
                      )}
                    >
                      Not certain.{" "}
                    </span>
                    {step.note ?? "Some details were unclear."} Confirm the
                    uncertain details with the speaker or your surroundings.
                  </p>
                ) : null}
              </motion.article>
            )}
          </AnimatePresence>
        </div>

        {!arrived ? (
          <div className="mt-8 grid grid-cols-[auto_1fr] gap-2 pb-2">
            <Button
              variant="secondary"
              size="icon-lg"
              onClick={previous}
              disabled={currentStep === 0}
              aria-label="Previous step"
            >
              <ArrowLeft aria-hidden className="size-5" />
            </Button>
            <Button size="lg" onClick={next}>
              {currentStep === last ? "Finish directions" : "Next step"}
              <ArrowRight aria-hidden className={cn("size-5", arrowNudge)} />
            </Button>
            <Link
              href="/lens"
              className={buttonStyles({
                variant: "secondary",
                size: "lg",
                className: "col-span-2",
              })}
            >
              <Camera aria-hidden className="size-5" />
              {demo ? "Demo Lens check" : "Lens check coming later"}
            </Link>
          </div>
        ) : null}

        <details
          className="group mt-6 border-t border-line pt-4 lg:open:pb-2"
          open
        >
          <summary className="caps flex cursor-pointer list-none items-center justify-between py-2 text-ink-muted [&::-webkit-details-marker]:hidden">
            All {steps.length} steps
            <span
              aria-hidden
              className="transition-transform group-open:rotate-180"
            >
              ⌄
            </span>
          </summary>
          <ol className="mt-2">
            {steps.map((item, index) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => go(index)}
                  aria-current={index === currentStep ? "step" : undefined}
                  className={cn(
                    "flex min-h-11 w-full items-center gap-3 rounded-xl px-2 py-2 text-left text-sm transition-colors hover:bg-surface-sunken",
                    index === currentStep ? "text-ink" : "text-ink-muted",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-6 shrink-0 place-items-center rounded-full font-mono text-[0.6875rem]",
                      index < currentStep || arrived
                        ? "bg-ink text-surface"
                        : index === currentStep
                          ? "bg-accent text-on-accent"
                          : "ring-1 ring-line-strong",
                    )}
                  >
                    {index + 1}
                  </span>
                  <span className="truncate">{item.instruction}</span>
                </button>
              </li>
            ))}
          </ol>
        </details>
        <p className="mt-4 hidden text-xs text-ink-muted lg:block">
          Tip: use ← and →, the step buttons, or swipe to move through the
          directions.
        </p>
      </section>
    </div>
  );
}
