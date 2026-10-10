"use client";

import { ArrowRight, Check } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { ConfidenceBadge } from "@/components/confidence-badge";
import { RouteSketch } from "@/components/route-sketch";
import { Button, arrowNudge, buttonStyles } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { ProgressBar } from "@/components/ui/progress-bar";
import { ActionBar } from "@/features/journey/components/flow/action-bar";
import { ScreenIntro } from "@/features/journey/components/flow/screen-intro";
import { HighlightedText } from "@/features/journey/components/highlighted-text";
import { demoJourney, processingStages } from "@/features/journey/fixtures";
import { unresolvedSteps, useJourney } from "@/features/journey/journey-store";
import { formatDistance, walkingMinutes } from "@/lib/format";
import { duration, ease, fadeUp, stagger } from "@/lib/motion";
import { cn } from "@/lib/utils";

type StageStatus = "pending" | "active" | "done";

function StageIcon({ status }: { status: StageStatus }) {
  if (status === "done") {
    return (
      <span className="grid size-7 place-items-center rounded-full bg-positive-soft text-positive">
        <Check aria-hidden className="size-4" />
      </span>
    );
  }
  if (status === "active") {
    return (
      <svg viewBox="0 0 28 28" aria-hidden className="size-7 motion-safe:animate-spin">
        <circle cx="14" cy="14" r="11" className="fill-none stroke-line-strong" strokeWidth="2" />
        <path d="M14 3a11 11 0 0 1 11 11" className="fill-none stroke-accent-ink" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  return <span aria-hidden className="size-7 rounded-full ring-1 ring-line-strong ring-inset" />;
}

const segments = demoJourney.transcript;

function TranscribePreview() {
  return (
    <motion.div initial="hidden" animate="visible" variants={stagger(0.022)} lang="pt" className="space-y-4 font-display text-xl leading-relaxed">
      {segments.map((segment) => (
        <p key={segment.id}>
          {segment.original.split(" ").map((word, index) => (
            <motion.span key={index} variants={fadeUp} className="inline-block">
              {word}&nbsp;
            </motion.span>
          ))}
        </p>
      ))}
    </motion.div>
  );
}

function TranslatePreview() {
  return (
    <motion.ol initial="hidden" animate="visible" variants={stagger(0.28)} className="space-y-5">
      {segments.map((segment) => (
        <motion.li key={segment.id} variants={fadeUp}>
          <p lang="pt" className="font-display text-sm text-ink-muted italic">
            {segment.original}
          </p>
          <p className="mt-1 text-lg leading-snug">{segment.translation}</p>
        </motion.li>
      ))}
    </motion.ol>
  );
}

function LandmarksPreview() {
  const { state } = useJourney();
  return (
    <div>
      <div className="space-y-3 text-lg leading-snug">
        {segments.map((segment) => (
          <p key={segment.id}>
            <HighlightedText text={segment.translation} phrases={segment.highlights.map((h) => h.translation)} />
          </p>
        ))}
      </div>
      <motion.ul initial="hidden" animate="visible" variants={stagger(0.18, 0.3)} className="mt-8 flex flex-wrap gap-2">
        {state.steps.map((step) => (
          <motion.li key={step.id} variants={fadeUp} className="flex items-center gap-2 rounded-full bg-surface py-1 pr-1 pl-4 text-sm ring-1 ring-line">
            {step.landmark}
            <ConfidenceBadge level={step.confidence} />
          </motion.li>
        ))}
      </motion.ul>
    </div>
  );
}

function RoutePreview() {
  const { state } = useJourney();
  return (
    <div>
      <div className="aspect-[4/3] overflow-hidden rounded-card bg-surface ring-1 ring-line">
        <RouteSketch variant="map" stops={state.steps.map((step) => step.anchor)} animateDraw title="Route map" />
      </div>
      <motion.ol initial="hidden" animate="visible" variants={stagger(0.12, 0.4)} className="mt-6 grid gap-2 sm:grid-cols-2">
        {state.steps.map((step, index) => (
          <motion.li key={step.id} variants={fadeUp} className="flex gap-3 text-sm">
            <span className="w-4 text-ink-muted tabular-nums">{index + 1}</span>
            <span>{step.landmark}</span>
          </motion.li>
        ))}
      </motion.ol>
    </div>
  );
}

const previews = [TranscribePreview, TranslatePreview, LandmarksPreview, RoutePreview];
const previewLabels = ["Transcript · Português", "Translation · English", "Landmarks", "Route"];

export function ProcessingScreen() {
  const { state } = useJourney();
  const [stage, setStage] = useState(0);
  const total = processingStages.length;
  const done = stage >= total;

  useEffect(() => {
    const current = processingStages[stage];
    if (!current) return;
    const timer = window.setTimeout(() => setStage((value) => value + 1), current.durationMs);
    return () => window.clearTimeout(timer);
  }, [stage]);

  const meters = state.steps.reduce((sum, step) => sum + step.distanceM, 0);
  const unsure = unresolvedSteps(state.steps).length;
  const previewIndex = Math.min(stage, previews.length - 1);
  const Preview = previews[previewIndex] ?? RoutePreview;

  return (
    <Container
      size="lg"
      className="grid flex-1 content-start gap-8 py-8 sm:py-12 lg:grid-cols-[0.85fr_1.15fr] lg:grid-rows-[auto_1fr] lg:gap-x-16 lg:gap-y-0 lg:py-16"
    >
      <div>
        <ScreenIntro
          title={
            done ? "Your route is ready." : "Shaping your route…"
          }
        >
          {done
            ? `${state.steps.length} steps · ${formatDistance(meters)} · about ${walkingMinutes(meters)} minutes on foot.`
            : "Gemini is listening closely: what was said, what it means, and where it leads."}
        </ScreenIntro>

        <ProgressBar value={done ? 1 : (stage + 0.5) / total} label="Processing progress" className="mt-10" />
      </div>

      <div className="lg:col-start-1 lg:row-start-2">
        <ol className="mt-2 border-b border-line">
          {processingStages.map((item, index) => {
            const status: StageStatus = index < stage ? "done" : index === stage ? "active" : "pending";
            return (
              <li
                key={item.id}
                aria-current={status === "active" ? "step" : undefined}
                className="flex items-start gap-4 border-t border-line py-5 first:border-t-0"
              >
                <span className="w-4 pt-0.5 text-sm text-ink-muted tabular-nums">{index + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className={cn("font-medium transition-colors", status === "pending" && "text-ink-muted")}>{item.label}</p>
                  <p className="mt-1 text-sm text-ink-muted">{item.detail}</p>
                </div>
                <StageIcon status={status} />
              </li>
            );
          })}
        </ol>

        <ActionBar note={done && unsure > 0 ? `${unsure} ${unsure === 1 ? "step needs" : "steps need"} a second look.` : undefined}>
          {done ? (
            <Link href="/review" className={buttonStyles({ size: "lg" })}>
              Review the route
              <ArrowRight aria-hidden className={cn("size-5", arrowNudge)} />
            </Link>
          ) : (
            <Button variant="ghost" onClick={() => setStage(total)}>
              Skip ahead
            </Button>
          )}
        </ActionBar>
      </div>

      <section
        aria-label="Live preview"
        className="row-start-2 rounded-panel bg-surface-raised p-5 ring-1 ring-line sm:p-8 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:min-h-[36rem]"
      >
        <p className="caps flex items-center gap-2 text-ink-muted">
          <span aria-hidden className={cn("size-1.5 rounded-full", done ? "bg-positive" : "bg-accent motion-safe:animate-pulse")} />
          {previewLabels[previewIndex]}
        </p>
        <AnimatePresence mode="wait">
          <motion.div
            key={previewIndex}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: duration.base, ease: ease.outSoft }}
            className="mt-6"
          >
            <Preview />
          </motion.div>
        </AnimatePresence>
      </section>

      <p aria-live="polite" className="sr-only">
        {done ? "Your route is ready to review." : `${processingStages[stage]?.label ?? ""}…`}
      </p>
    </Container>
  );
}
