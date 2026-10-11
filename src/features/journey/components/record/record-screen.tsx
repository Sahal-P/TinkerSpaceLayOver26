"use client";

import {
  ArrowRight,
  AudioLines,
  Pause,
  Play,
  RotateCcw,
  Upload,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Button, arrowNudge } from "@/components/ui/button";
import { ChoiceChips } from "@/components/ui/choice-chips";
import { Container } from "@/components/ui/container";
import { Waveform } from "@/components/waveform";
import { ActionBar } from "@/features/journey/components/flow/action-bar";
import { ScreenIntro } from "@/features/journey/components/flow/screen-intro";
import { RecordButton } from "./record-button";
import { languageOptions } from "@/features/journey/fixtures";
import { useJourney } from "@/features/journey/journey-store";
import { fetchSampleClip } from "@/features/journey/sample-clip";
import { useAudioRecorder } from "@/features/journey/use-audio-recorder";
import { formatClock } from "@/lib/format";
import { duration, ease } from "@/lib/motion";
import { cn } from "@/lib/utils";

const subscribeHydration = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

export function RecordScreen() {
  const hydrated = useSyncExternalStore(
    subscribeHydration,
    clientReady,
    serverReady,
  );
  const { state, dispatch, startExtraction } = useJourney();
  const router = useRouter();
  const reducedMotion = useReducedMotion() ?? false;
  const recorder = useAudioRecorder(state.clip, reducedMotion);
  const [consent, setConsent] = useState(state.consent);
  const [playing, setPlaying] = useState(false);
  const [playhead, setPlayhead] = useState(0);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement>(null);
  const upload = useRef<HTMLInputElement>(null);
  const sampleNote = useId();
  useEffect(() => {
    if (!recorder.clip) return;
    const element = audio.current;
    if (!element) return;
    const next = URL.createObjectURL(recorder.clip.file);
    element.src = next;
    element.load();
    return () => {
      element.pause();
      element.removeAttribute("src");
      element.load();
      URL.revokeObjectURL(next);
    };
  }, [recorder.clip]);
  const busy = ["requesting", "recording", "validating"].includes(
    recorder.phase,
  );
  const clip = recorder.clip;
  const seconds = (clip?.durationMs ?? recorder.elapsedMs) / 1000;
  const clearPreviousClip = () => {
    audio.current?.pause();
    dispatch({ type: "clip/clear" });
    dispatch({ type: "consent/set", consent });
    setPlaying(false);
    setPlayhead(0);
    setPlaybackError(null);
  };
  const reset = () => {
    audio.current?.pause();
    recorder.reset();
    dispatch({ type: "clip/clear" });
    setPlaying(false);
    setPlayhead(0);
    setPlaybackError(null);
  };
  const togglePlayback = async () => {
    const element = audio.current;
    if (!element) return;
    if (!element.paused) {
      element.pause();
      return;
    }
    if (element.ended) element.currentTime = 0;
    try {
      await element.play();
      setPlaybackError(null);
    } catch {
      setPlaybackError(
        "Playback is unavailable in this browser. You can still process the validated clip.",
      );
    }
  };
  const chooseSample = () => {
    clearPreviousClip();
    recorder.loadClip(fetchSampleClip);
  };
  const shape = () => {
    audio.current?.pause();
    if (clip && startExtraction(clip, consent)) router.push("/processing");
  };
  const demo = () => {
    reset();
    dispatch({ type: "demo/loaded" });
    router.push("/processing");
  };
  return (
    <Container
      size="lg"
      className="grid flex-1 gap-10 py-8 sm:py-12 lg:grid-cols-[0.95fr_1.05fr] lg:items-start lg:gap-16 lg:py-16"
    >
      <div className="lg:sticky lg:top-36">
        <ScreenIntro title="Ask a local for directions.">
          Record Malayalam, Hindi, English, or a mixture. After you stop, Gemini
          transcribes and translates the clip into directions.
        </ScreenIntro>
        <div className="mt-8">
          <p className="caps text-ink-muted">Language hint</p>
          <ChoiceChips
            name="language"
            legend="Language they will speak"
            options={languageOptions}
            value={state.language}
            onChange={(language) =>
              dispatch({ type: "language/set", language })
            }
            className="mt-3"
          />
          <p className="mt-3 text-sm text-ink-muted">
            Detection follows the audio, even if this hint is wrong.
          </p>
        </div>
        <ol className="mt-10 hidden border-t border-line sm:block">
          {[
            "Ask for visible landmarks and clear turns.",
            "Audio only, at most 4 MiB and two minutes.",
            "Review every instruction before following it.",
          ].map((tip) => (
            <li
              key={tip}
              className="border-b border-line py-4 text-sm text-ink-muted"
            >
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
            <span
              className={cn(
                "flex items-center gap-2",
                recorder.phase === "recording"
                  ? "text-accent-ink"
                  : "text-ink-muted",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "size-2 rounded-full",
                  recorder.phase === "recording"
                    ? "bg-accent motion-safe:animate-pulse"
                    : "bg-line-strong",
                )}
              />
              {
                {
                  idle: "Ready",
                  requesting: "Requesting microphone",
                  recording: "Recording",
                  validating: "Checking audio",
                  ready: "Ready to shape",
                  error: "Try again",
                }[recorder.phase]
              }
            </span>
            <span className="text-ink-muted">2:00 max</span>
          </div>
          <div className="relative mt-10">
            <Waveform
              levels={recorder.levels}
              progress={clip ? playhead / Math.max(seconds, 1) : undefined}
              className="h-28"
            />
            {clip ? (
              <input
                type="range"
                aria-label="Playback position"
                aria-valuetext={`${formatClock(playhead)} of ${formatClock(seconds)}`}
                min={0}
                max={seconds}
                step={0.1}
                value={playhead}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  if (audio.current) audio.current.currentTime = value;
                  setPlayhead(value);
                }}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
            ) : null}
          </div>
          <p className="mt-8 text-center font-mono text-6xl font-light tracking-tight tabular-nums sm:text-7xl">
            {formatClock(playing ? playhead : seconds)}
          </p>
          <div className="mt-8 min-h-36">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={recorder.phase}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: duration.base, ease: ease.outSoft }}
                className="flex flex-col items-center gap-4"
              >
                {recorder.phase === "recording" ? (
                  <>
                    <RecordButton recording onClick={recorder.stop} />
                    <p className="text-sm text-ink-muted">
                      Tap to stop. Capture stops before the two-minute limit.
                    </p>
                  </>
                ) : !busy && !clip ? (
                  <RecordButton
                    recording={false}
                    disabled={!consent || !hydrated}
                    onClick={() => {
                      clearPreviousClip();
                      void recorder.start(consent);
                    }}
                  />
                ) : null}
                {!busy ? (
                  <label className="flex cursor-pointer items-start gap-3 text-sm">
                    <input
                      type="checkbox"
                      disabled={!hydrated}
                      checked={consent}
                      onChange={(event) => {
                        setConsent(event.target.checked);
                        dispatch({
                          type: "consent/set",
                          consent: event.target.checked,
                        });
                      }}
                      className="mt-0.5 size-5 shrink-0 accent-accent-ink"
                    />
                    I have permission to record and send this clip to Google
                    Gemini for processing.
                  </label>
                ) : null}
                {clip ? (
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <Button variant="secondary" onClick={reset}>
                      <RotateCcw aria-hidden className="size-4" />
                      Record again
                    </Button>
                    <Button
                      variant="secondary"
                      size="icon-lg"
                      onClick={() => {
                        void togglePlayback();
                      }}
                      aria-label={playing ? "Pause playback" : "Play recording"}
                    >
                      {playing ? (
                        <Pause aria-hidden className="size-5" />
                      ) : (
                        <Play aria-hidden className="size-5" />
                      )}
                    </Button>
                  </div>
                ) : null}
                {!busy ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      <Button
                        variant="ghost"
                        disabled={!hydrated}
                        onClick={() => upload.current?.click()}
                      >
                        <Upload aria-hidden className="size-4" />
                        Upload audio
                      </Button>
                      <Button
                        variant="ghost"
                        disabled={!hydrated}
                        aria-describedby={sampleNote}
                        onClick={chooseSample}
                      >
                        <AudioLines aria-hidden className="size-4" />
                        Use sample audio
                      </Button>
                    </div>
                    <p
                      id={sampleNote}
                      className="max-w-xs text-center text-xs text-ink-muted"
                    >
                      Sample: a synthetic Hindi recording generated with
                      ElevenLabs.
                    </p>
                  </div>
                ) : recorder.phase !== "recording" ? (
                  <Button variant="ghost" onClick={reset}>
                    Cancel
                  </Button>
                ) : null}
              </motion.div>
            </AnimatePresence>
          </div>
          {recorder.error ? (
            <p
              role="alert"
              className="mt-4 rounded-card bg-critical-soft p-4 text-sm"
            >
              {recorder.error}
            </p>
          ) : null}
          {playbackError ? (
            <p role="alert" className="mt-4 text-sm text-ink-muted">
              {playbackError}
            </p>
          ) : null}
          <input
            ref={upload}
            type="file"
            aria-label="Upload directions audio"
            disabled={!hydrated || busy}
            accept="audio/*,.wav,.mp3,.m4a,.mp4,.ogg,.opus,.webm,.flac"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                clearPreviousClip();
                recorder.upload(file);
              }
              event.target.value = "";
            }}
          />
          <audio
            ref={audio}
            preload="metadata"
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onTimeUpdate={(event) =>
              setPlayhead(event.currentTarget.currentTime)
            }
            onEnded={() => setPlaying(false)}
            onError={() =>
              setPlaybackError(
                "Playback is unavailable in this browser. You can still process the validated clip.",
              )
            }
          />
        </section>
        <p className="mt-6 text-center text-sm text-ink-muted">
          Prefer to explore first?{" "}
          <button
            type="button"
            disabled={busy || !hydrated}
            onClick={demo}
            className="font-medium text-accent-ink underline underline-offset-4"
          >
            Try the demo guide
          </button>
        </p>
        {clip ? (
          <ActionBar note="The clip stays in memory. Processing sends it to Google Gemini.">
            <Button size="lg" disabled={!consent || !hydrated} onClick={shape}>
              Shape my route
              <ArrowRight aria-hidden className={cn("size-5", arrowNudge)} />
            </Button>
          </ActionBar>
        ) : null}
      </div>
      <p aria-live="polite" className="sr-only">
        {recorder.phase === "ready"
          ? "Audio validated. Ready to shape."
          : recorder.phase === "validating"
            ? "Checking audio."
            : ""}
      </p>
    </Container>
  );
}
