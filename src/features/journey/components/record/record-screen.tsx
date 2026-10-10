"use client";

import { ArrowRight, Check, Pause, Play, RotateCcw, Upload } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { Button, arrowNudge, buttonStyles } from "@/components/ui/button";
import { ChoiceChips } from "@/components/ui/choice-chips";
import { Container } from "@/components/ui/container";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Waveform, speechLevels } from "@/components/waveform";
import { ActionBar } from "@/features/journey/components/flow/action-bar";
import { ScreenIntro } from "@/features/journey/components/flow/screen-intro";
import { RecordButton } from "@/features/journey/components/record/record-button";
import { demoJourney, languageOptions } from "@/features/journey/fixtures";
import { useJourney, type RecordingSource } from "@/features/journey/journey-store";
import { formatClock } from "@/lib/format";
import { duration as motionDuration, ease } from "@/lib/motion";
import { cn } from "@/lib/utils";

type Phase = "idle" | "recording" | "recorded" | "uploading" | "uploaded";

const MAX_SECONDS = 120;
const MIN_SECONDS = 2;
const UPLOAD_MS = 2200;
const LEVELS = speechLevels(56, 7);
const RESTING = LEVELS.map((level) => 0.06 + level * 0.06);

const tips = [
  "Ask them to name what you'll see: shops, colors, churches, stairs.",
  "Only the audio is used. You don't need to film anyone.",
  "Two minutes is plenty. Shorter directions are easier to follow.",
];

const statusLabels: Record<Phase, string> = {
  idle: "Ready",
  recording: "Recording",
  recorded: "Recorded",
  uploading: "Uploading",
  uploaded: "Ready to shape",
};

export function RecordScreen() {
  const { state, dispatch } = useJourney();
  const saved = state.recording;
  const [phase, setPhase] = useState<Phase>(saved ? "uploaded" : "idle");
  const [elapsed, setElapsed] = useState(0);
  const [length, setLength] = useState(saved?.durationSec ?? 0);
  const [source, setSource] = useState<RecordingSource>(saved?.source ?? "live");
  const [playing, setPlaying] = useState(false);
  const [playhead, setPlayhead] = useState(0);
  const [upload, setUpload] = useState(0);
  const [announcement, setAnnouncement] = useState("");
  const [consent, setConsent] = useState(Boolean(saved));
  const playback = useRef({ startedAt: 0, from: 0 });

  // Recording clock; stops itself at the two-minute cap.
  useEffect(() => {
    if (phase !== "recording") return;
    const startedAt = performance.now();
    const timer = window.setInterval(() => {
      const seconds = (performance.now() - startedAt) / 1000;
      if (seconds < MAX_SECONDS) {
        setElapsed(seconds);
        return;
      }
      setElapsed(MAX_SECONDS);
      setLength(MAX_SECONDS);
      setPhase("recorded");
      setAnnouncement("Two minutes reached. Recording stopped.");
    }, 100);
    return () => window.clearInterval(timer);
  }, [phase]);

  // Mock playback clock.
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      const position = playback.current.from + (performance.now() - playback.current.startedAt) / 1000;
      if (position < length) {
        setPlayhead(position);
        return;
      }
      setPlayhead(length);
      setPlaying(false);
    }, 80);
    return () => window.clearInterval(timer);
  }, [playing, length]);

  // Mock upload.
  useEffect(() => {
    if (phase !== "uploading") return;
    const startedAt = performance.now();
    const timer = window.setInterval(() => {
      const progress = Math.min(1, (performance.now() - startedAt) / UPLOAD_MS);
      setUpload(progress);
      if (progress < 1) return;
      window.clearInterval(timer);
      setPhase("uploaded");
      dispatch({ type: "recording/saved", durationSec: Math.round(length), source });
      setAnnouncement("Upload complete. Your recording is ready to shape into a route.");
    }, 80);
    return () => window.clearInterval(timer);
  }, [phase, length, source, dispatch]);

  const start = () => {
    setSource("live");
    setElapsed(0);
    setPlayhead(0);
    setPhase("recording");
    setAnnouncement("Recording started.");
  };

  const stop = () => {
    if (elapsed < MIN_SECONDS) {
      setPhase("idle");
      setAnnouncement("That was a little short. Try again and let them talk.");
      return;
    }
    setLength(elapsed);
    setPhase("recorded");
    setAnnouncement(`Recording stopped at ${formatClock(elapsed)}.`);
  };

  const useSample = () => {
    setSource("sample");
    setLength(demoJourney.durationSec);
    setPlayhead(0);
    setPlaying(false);
    setPhase("recorded");
    setAnnouncement(`Sample loaded: ${formatClock(demoJourney.durationSec)} of directions in Portuguese.`);
  };

  const togglePlayback = () => {
    if (playing) {
      setPlaying(false);
      return;
    }
    const from = playhead >= length ? 0 : playhead;
    playback.current = { startedAt: performance.now(), from };
    setPlayhead(from);
    setPlaying(true);
  };

  const seek = (seconds: number) => {
    playback.current = { startedAt: performance.now(), from: seconds };
    setPlayhead(seconds);
  };

  const reRecord = () => {
    setPlaying(false);
    setPlayhead(0);
    setElapsed(0);
    setPhase("idle");
  };

  const startUpload = () => {
    setPlaying(false);
    setUpload(0);
    setPhase("uploading");
    setAnnouncement("Uploading recording.");
  };

  const clock = phase === "recording" ? elapsed : phase === "recorded" && (playing || playhead > 0) ? playhead : phase === "idle" ? 0 : length;
  const progress = phase === "recorded" ? (length ? playhead / length : 0) : phase === "uploading" || phase === "uploaded" ? 1 : undefined;

  return (
    <Container size="lg" className="grid flex-1 gap-10 py-8 sm:py-12 lg:grid-cols-[0.95fr_1.05fr] lg:items-start lg:gap-16 lg:py-16">
      <div className="lg:sticky lg:top-36">
        <ScreenIntro
          title="Ask a local for directions."
        >
          Hold your phone between you and let them talk, in any language. Local to Lens translates as it listens.
        </ScreenIntro>

        <div className="mt-8">
          <p className="caps text-ink-muted">They&rsquo;ll speak</p>
          <ChoiceChips
            name="language"
            legend="Language they will speak"
            options={languageOptions}
            value={state.language}
            onChange={(language) => dispatch({ type: "language/set", language })}
            className="mt-3"
          />
        </div>

        <ol className="mt-10 hidden border-t border-line sm:block">
          {tips.map((tip, index) => (
            <li key={tip} className="flex gap-4 border-b border-line py-4 text-sm text-ink-muted">
              <span className="w-4 font-medium text-accent-ink tabular-nums">{index + 1}</span>
              {tip}
            </li>
          ))}
        </ol>
      </div>

      <div>
        <section
          aria-label="Recorder"
          className="relative overflow-hidden rounded-panel bg-surface-raised p-5 shadow-soft ring-1 ring-line sm:p-8"
        >
          <div className="caps flex items-center justify-between">
            <span className={cn("flex items-center gap-2", phase === "recording" ? "text-accent-ink" : "text-ink-muted")}>
              <span
                aria-hidden
                className={cn(
                  "size-2 rounded-full",
                  phase === "recording" ? "bg-accent motion-safe:animate-pulse" : phase === "uploaded" ? "bg-positive" : "bg-line-strong",
                )}
              />
              {statusLabels[phase]}
            </span>
            <span className="text-ink-muted">{source === "sample" && phase !== "idle" ? "Sample · Português" : "2:00 max"}</span>
          </div>

          <div className="relative mt-10">
            <Waveform levels={phase === "idle" ? RESTING : LEVELS} live={phase === "recording"} progress={progress ?? 0} className="h-28" />
            {phase === "recorded" ? (
              <input
                type="range"
                aria-label="Playback position"
                aria-valuetext={`${formatClock(playhead)} of ${formatClock(length)}`}
                min={0}
                max={length}
                step={0.1}
                value={playhead}
                onChange={(event) => seek(Number(event.target.value))}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
            ) : null}
          </div>

          <p className="mt-8 text-center font-mono text-6xl font-light tracking-tight tabular-nums sm:text-7xl">
            {formatClock(clock)}
            {phase === "recorded" ? <span className="text-2xl text-ink-muted"> / {formatClock(length)}</span> : null}
          </p>

          <div className="mt-8 min-h-36">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={phase === "recording" ? "idle" : phase}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: motionDuration.base, ease: ease.outSoft }}
                className="flex flex-col items-center gap-4"
              >
                {phase === "idle" || phase === "recording" ? (
                  <>
                    <RecordButton
                      recording={phase === "recording"}
                      disabled={phase === "idle" && !consent}
                      onClick={phase === "recording" ? stop : start}
                    />
                    {phase === "idle" ? (
                      <label className="flex cursor-pointer items-center gap-3 text-sm">
                        <input
                          type="checkbox"
                          checked={consent}
                          onChange={(event) => setConsent(event.target.checked)}
                          className="size-5 shrink-0 accent-accent-ink"
                        />
                        I asked before recording
                      </label>
                    ) : (
                      <p className="text-sm text-ink-muted">Tap to stop when they&rsquo;re done.</p>
                    )}
                  </>
                ) : null}

                {phase === "recorded" ? (
                  <div className="flex w-full flex-wrap items-center justify-center gap-3">
                    <Button variant="secondary" onClick={reRecord}>
                      <RotateCcw aria-hidden className="size-4" />
                      Re-record
                    </Button>
                    <Button variant="secondary" size="icon-lg" onClick={togglePlayback} aria-label={playing ? "Pause playback" : "Play recording"}>
                      {playing ? <Pause aria-hidden className="size-5 fill-current" /> : <Play aria-hidden className="size-5 fill-current" />}
                    </Button>
                    <Button onClick={startUpload}>
                      <Upload aria-hidden className="size-4" />
                      Use this recording
                    </Button>
                  </div>
                ) : null}

                {phase === "uploading" ? (
                  <div className="w-full max-w-sm">
                    <ProgressBar value={upload} label="Upload progress" />
                    <div className="mt-3 flex items-center justify-between text-sm text-ink-muted">
                      <span>Uploading securely…</span>
                      <span className="font-mono tabular-nums">{Math.round(upload * 100)}%</span>
                    </div>
                    <Button variant="ghost" size="sm" className="mt-3 w-full" onClick={() => setPhase("recorded")}>
                      Cancel
                    </Button>
                  </div>
                ) : null}

                {phase === "uploaded" ? (
                  <div className="flex flex-col items-center gap-3 text-center">
                    <span className="grid size-14 place-items-center rounded-full bg-positive-soft text-positive">
                      <Check aria-hidden className="size-6" />
                    </span>
                    <p className="font-display text-xl">Recording saved</p>
                    <Button variant="ghost" size="sm" onClick={reRecord}>
                      Record again
                    </Button>
                  </div>
                ) : null}
              </motion.div>
            </AnimatePresence>
          </div>
        </section>

        {phase === "idle" ? (
          <p className="mt-6 text-center text-sm text-ink-muted">
            No local nearby?{" "}
            <button type="button" onClick={useSample} className="font-medium text-accent-ink underline decoration-1 underline-offset-4 hover:text-ink">
              Use a sample recording
            </button>
          </p>
        ) : null}

        <ActionBar note={phase === "uploaded" ? "Next, Gemini turns the recording into steps." : undefined} className={cn(phase !== "uploaded" && "hidden")}>
          <Link href="/processing" className={buttonStyles({ size: "lg" })}>
            Shape my route
            <ArrowRight aria-hidden className={cn("size-5", arrowNudge)} />
          </Link>
        </ActionBar>
      </div>

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </Container>
  );
}
