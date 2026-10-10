"use client";
import { ArrowRight, Check } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ConfidenceBadge } from "@/components/confidence-badge";
import { Button, buttonStyles } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { ProgressBar } from "@/components/ui/progress-bar";
import { processingStages } from "@/features/journey/fixtures";
import { useJourney } from "@/features/journey/journey-store";
import { detectedLanguageLabel } from "@/features/journey/presentation";
import { FlowEmpty } from "@/features/journey/components/flow/flow-empty";
import { ScreenIntro } from "@/features/journey/components/flow/screen-intro";
import { TranscriptPanel } from "@/features/journey/components/review/transcript-panel";
import { fadeUp } from "@/lib/motion";

export function ProcessingScreen() {
  const { state, startExtraction, cancelExtraction } = useJourney();
  const [now, setNow] = useState(0);
  const retryAt = state.extraction.error?.retryAt ?? 0;
  useEffect(() => {
    if (!retryAt) return;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [retryAt]);
  if (!state.clip && !state.draft && state.extraction.status === "idle")
    return <FlowEmpty />;
  const done = state.extraction.status === "success" && state.draft;
  const error = state.extraction.error;
  const pending = ["uploading", "processing"].includes(state.extraction.status);
  return (
    <Container
      size="lg"
      className="grid flex-1 gap-10 py-8 sm:py-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16"
    >
      <div>
        <ScreenIntro
          title={
            done
              ? "Your directions are ready."
              : error
                ? "The clip needs another try."
                : "Shaping your directions."
          }
        >
          {state.mode === "demo"
            ? "Demo example — no audio was sent and no AI call was made."
            : done
              ? `${detectedLanguageLabel(done)} → English. Review the original words and every extracted step.`
              : "Uploading audio, then transcribing, translating, and extracting only what was spoken."}
        </ScreenIntro>
        <ol className="mt-8 space-y-5">
          {processingStages.map((stage) => (
            <li key={stage.id} className="flex items-center gap-3">
              <span className="grid size-7 place-items-center rounded-full ring-1 ring-line">
                {done ? (
                  <Check aria-hidden className="size-4 text-positive" />
                ) : (
                  <span
                    aria-hidden
                    className="size-2 rounded-full bg-line-strong"
                  />
                )}
              </span>
              <div>
                <p>{stage.label}</p>
                <p className="text-sm text-ink-muted">{stage.detail}</p>
              </div>
            </li>
          ))}
        </ol>
        {state.extraction.status === "uploading" ? (
          <ProgressBar
            className="mt-8"
            value={state.extraction.progress}
            label="Upload progress"
          />
        ) : null}
        {state.extraction.status === "processing" ? (
          <p role="status" className="mt-8 text-sm text-ink-muted">
            The server is validating and processing the clip. Results appear
            when both Gemini stages finish.
          </p>
        ) : null}
        {pending ? (
          <Button variant="ghost" className="mt-8" onClick={cancelExtraction}>
            Cancel processing
          </Button>
        ) : null}
        {error ? (
          <div role="alert" className="mt-8 rounded-card bg-critical-soft p-5">
            <p>{error.message}</p>
            {error.requestId ? (
              <p className="mt-3 break-all font-mono text-xs">
                Request: {error.requestId}
              </p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-3">
              {error.retryable && state.clip ? (
                <Button
                  disabled={retryAt > now || !state.consent}
                  onClick={() => startExtraction()}
                >
                  {retryAt > now ? "Wait before retrying" : "Retry this clip"}
                </Button>
              ) : null}
              <Link
                href="/record"
                className={buttonStyles({ variant: "secondary" })}
              >
                Record or choose another clip
              </Link>
            </div>
          </div>
        ) : null}
        {state.extraction.status === "idle" && state.clip ? (
          <Button
            className="mt-8"
            disabled={!state.consent}
            onClick={() => startExtraction()}
          >
            Process this clip
          </Button>
        ) : null}
        {done ? (
          <Link
            href="/review"
            className={buttonStyles({ size: "lg", className: "mt-8" })}
          >
            Review my route
            <ArrowRight aria-hidden className="size-5" />
          </Link>
        ) : null}
      </div>
      <div>
        {done ? (
          <motion.div initial="hidden" animate="visible" variants={fadeUp}>
            <TranscriptPanel />
            <ul className="mt-8 space-y-3">
              {state.steps.map((step) => (
                <li
                  key={step.id}
                  className="rounded-card bg-surface-raised p-4 ring-1 ring-line"
                >
                  <p>{step.instruction}</p>
                  <div className="mt-2">
                    <ConfidenceBadge level={step.confidence} />
                  </div>
                </li>
              ))}
            </ul>
          </motion.div>
        ) : (
          <div className="rounded-panel bg-surface-raised p-8 ring-1 ring-line">
            <p className="font-display text-2xl">
              The speaker’s words come first.
            </p>
            <p className="mt-4 text-ink-muted">
              No transcript, landmarks, or directions are shown until the
              response is validated. Missing details stay missing.
            </p>
          </div>
        )}
      </div>
    </Container>
  );
}
