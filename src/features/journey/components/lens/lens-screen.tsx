"use client";

import { ArrowLeft, ArrowRight, Camera, Check, CircleHelp, ImageUp, RotateCcw, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ChangeEvent } from "react";

import { LensArt, type LensView } from "@/components/lens-art";
import type { SceneStopId } from "@/components/scene/stops";
import { Badge } from "@/components/ui/badge";
import { Button, arrowNudge, buttonStyles } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Viewfinder } from "@/components/viewfinder";
import { ScreenIntro } from "@/features/journey/components/flow/screen-intro";
import { lensScenarios, lensVerdict, type LensVerdict } from "@/features/journey/fixtures";
import { useJourney } from "@/features/journey/journey-store";
import type { LensScenario } from "@/features/journey/schemas";
import { duration, ease } from "@/lib/motion";
import { cn } from "@/lib/utils";

type Capture = { kind: "sample"; scenario: LensScenario } | { kind: "photo"; url: string; scenario: LensScenario };
type Phase = "aim" | "analyzing" | "result";

const ANALYZE_MS = 2200;

const views: Record<SceneStopId, LensView> = {
  tram: "tram",
  bakery: "bakery",
  archway: "archway",
  church: "church",
  castle: "stairs",
  miradouro: "kiosk",
};

const tones = {
  match: { tone: "positive", label: "Match", icon: Check, panel: "bg-positive-soft", text: "text-positive" },
  unsure: { tone: "caution", label: "Unsure", icon: CircleHelp, panel: "bg-caution-soft", text: "text-caution" },
  mismatch: { tone: "critical", label: "No match", icon: X, panel: "bg-critical-soft", text: "text-critical" },
} as const;

const checkIcons = { pass: Check, unknown: CircleHelp, fail: X } as const;

export function LensScreen() {
  const router = useRouter();
  const { state, dispatch } = useJourney();
  const index = state.currentStep;
  const step = state.steps[index] ?? state.steps[0];
  const [phase, setPhase] = useState<Phase>("aim");
  const [capture, setCapture] = useState<Capture | null>(null);
  const [verdict, setVerdict] = useState<LensVerdict | null>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const libraryInput = useRef<HTMLInputElement>(null);

  // Free local photo previews when they're replaced or the screen closes.
  useEffect(() => {
    if (capture?.kind !== "photo") return;
    const { url } = capture;
    return () => URL.revokeObjectURL(url);
  }, [capture]);

  // Mock comparison.
  useEffect(() => {
    if (phase !== "analyzing" || !capture || !step) return;
    const timer = window.setTimeout(() => {
      const result = lensVerdict(capture.scenario, step);
      setVerdict(result);
      setPhase("result");
      dispatch({ type: "lens/checked", stepId: step.id, outcome: result.outcome });
    }, ANALYZE_MS);
    return () => window.clearTimeout(timer);
  }, [phase, capture, step, dispatch]);

  if (!step) return null;

  const expected: LensView = step.anchor ? views[step.anchor] : "street";
  const captured: LensView | null =
    capture?.kind === "sample" ? (capture.scenario.outcome === "mismatch" ? (expected === "street" ? "church" : "street") : expected) : null;

  const analyze = (next: Capture) => {
    setVerdict(null);
    setCapture(next);
    setPhase("analyzing");
  };

  const onFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    // Photos stay on the device; the demo returns an honest "unsure".
    const partial = lensScenarios.find((scenario) => scenario.outcome === "unsure") ?? lensScenarios[1];
    if (partial) analyze({ kind: "photo", url: URL.createObjectURL(file), scenario: partial });
  };

  const reset = () => {
    setPhase("aim");
    setCapture(null);
    setVerdict(null);
  };

  const continueJourney = () => {
    if (verdict?.outcome === "match" && index < state.steps.length - 1) dispatch({ type: "guide/moved", index: index + 1 });
    router.push("/guide");
  };

  const tone = verdict ? tones[verdict.outcome] : null;

  return (
    <Container size="xl" className="grid flex-1 gap-8 py-6 sm:py-10 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1fr)] lg:items-start lg:gap-16 lg:py-14">
      <Viewfinder
        locked={phase === "analyzing"}
        topLeft={<span className="flex items-center gap-2"><span aria-hidden className={cn("size-1.5 rounded-full", phase === "analyzing" ? "bg-accent-vivid motion-safe:animate-pulse" : "bg-ink-inverse")} />Lens check</span>}
        topRight="1×"
        className="aspect-[3/4] w-full max-h-[70svh] lg:sticky lg:top-28 lg:max-h-[calc(100dvh-9rem)]"
        bottom={
          tone && verdict ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-between rounded-2xl bg-surface-raised px-4 py-3 text-ink shadow-soft"
            >
              <span className="flex items-center gap-2 font-medium">
                <tone.icon aria-hidden className={cn("size-4", tone.text)} />
                {tone.label}
              </span>
              <span className="font-mono text-sm tabular-nums">{Math.round(verdict.score * 100)}%</span>
            </motion.div>
          ) : (
            <p className="caps rounded-2xl bg-surface-inverse/70 px-4 py-3 text-center text-ink-inverse">
              {phase === "analyzing" ? `Comparing with “${step.landmark}”…` : `Looking for: ${step.landmark}`}
            </p>
          )
        }
      >
        <AnimatePresence mode="wait" initial={false}>
          {capture ? (
            <motion.div
              key={capture.kind === "photo" ? capture.url : capture.scenario.id}
              initial={{ opacity: 0, scale: 1.04 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: duration.slow, ease: ease.outSoft }}
              className="absolute inset-0"
            >
              {capture.kind === "photo" ? (
                // eslint-disable-next-line @next/next/no-img-element -- local blob preview; nothing to optimize
                <img src={capture.url} alt="Your photo" className="h-full w-full object-cover" />
              ) : captured ? (
                <LensArt
                  view={captured}
                  className={cn(capture.scenario.outcome === "unsure" && "origin-[70%_40%] scale-[1.9] blur-[1.5px]")}
                />
              ) : null}
            </motion.div>
          ) : (
            <motion.div key="aim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0">
              <LensArt view={expected} className="opacity-25 blur-[3px]" />
              <div className="absolute inset-0 grid place-items-center">
                <span className="grid size-24 place-items-center rounded-full ring-1 ring-ink-inverse/60">
                  <span className="size-2 rounded-full bg-ink-inverse" />
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {phase === "analyzing" ? (
          <div aria-hidden className="absolute inset-x-0 top-0 h-full [--scan-distance:100%]">
            <span className="block h-0.5 w-full bg-accent-vivid shadow-[0_0_24px_4px] shadow-accent-vivid/50 motion-safe:animate-scan" />
          </div>
        ) : null}
      </Viewfinder>

      <div>
        <ScreenIntro
          title="Is this the right place?"
        >
          Point your camera at the landmark and Local to Lens compares it with what the local described.
        </ScreenIntro>

        <section aria-label="What to look for" className="mt-8 rounded-panel bg-surface-raised p-6 ring-1 ring-line">
          <p className="caps text-ink-muted">Step {index + 1} · Looking for</p>
          <p className="mt-2 font-display text-2xl">{step.landmark}</p>
          <p className="mt-2 text-ink-muted">{step.lookFor || step.instruction}</p>
        </section>

        <div className="mt-8" aria-live="polite">
          <AnimatePresence mode="wait" initial={false}>
            {phase === "result" && verdict && tone ? (
              <motion.section
                key="result"
                aria-label="Comparison result"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: duration.slow, ease: ease.outSoft }}
              >
                <div className={cn("rounded-panel p-6", tone.panel)}>
                  <div className="flex items-center justify-between gap-4">
                    <Badge tone={tone.tone}>{tone.label}</Badge>
                    <span className="font-mono text-sm tabular-nums">{Math.round(verdict.score * 100)}% likely</span>
                  </div>
                  <h2 className="mt-4 font-display text-3xl">{verdict.headline}</h2>
                  <div
                    role="meter"
                    aria-label="Match likelihood"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(verdict.score * 100)}
                    className="mt-4 h-1.5 overflow-hidden rounded-full bg-surface-raised"
                  >
                    <motion.span
                      className={cn("block h-full origin-left rounded-full", tone.text, "bg-current")}
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: verdict.score }}
                      transition={{ duration: duration.cinematic, ease: ease.outSoft }}
                    />
                  </div>
                  <p className="mt-4 text-ink">{verdict.detail}</p>
                  <ul className="mt-5 space-y-2 text-sm">
                    {verdict.checks.map((check) => {
                      const Icon = checkIcons[check.status];
                      return (
                        <li key={check.label} className="flex items-center gap-2">
                          <Icon aria-hidden className={cn("size-4", check.status === "pass" ? "text-positive" : check.status === "fail" ? "text-critical" : "text-caution")} />
                          <span>{check.label}</span>
                          <span className="sr-only">: {check.status === "pass" ? "matches" : check.status === "fail" ? "doesn't match" : "can't tell"}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
                {capture?.kind === "photo" ? (
                  <p className="mt-3 text-sm text-ink-muted">Demo result: your photo stayed on this device and wasn&rsquo;t analyzed.</p>
                ) : null}
                <div className="mt-6 flex flex-col gap-2 sm:flex-row">
                  {verdict.outcome === "match" ? (
                    <Button size="lg" onClick={continueJourney}>
                      {index < state.steps.length - 1 ? "Continue to next step" : "Back to the guide"}
                      <ArrowRight aria-hidden className={cn("size-5", arrowNudge)} />
                    </Button>
                  ) : (
                    <>
                      <Button size="lg" onClick={reset}>
                        <RotateCcw aria-hidden className="size-4" />
                        Try again
                      </Button>
                      <Button variant="secondary" size="lg" onClick={continueJourney}>
                        Continue anyway
                      </Button>
                    </>
                  )}
                </div>
              </motion.section>
            ) : (
              <motion.div key="aim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button size="lg" onClick={() => cameraInput.current?.click()} disabled={phase === "analyzing"}>
                    <Camera aria-hidden className="size-5" />
                    Take a photo
                  </Button>
                  <Button variant="secondary" size="lg" onClick={() => libraryInput.current?.click()} disabled={phase === "analyzing"}>
                    <ImageUp aria-hidden className="size-5" />
                    Upload
                  </Button>
                </div>
                <input ref={cameraInput} type="file" accept="image/*" capture="environment" hidden onChange={onFile} />
                <input ref={libraryInput} type="file" accept="image/*" hidden onChange={onFile} />

                <p className="caps mt-8 text-ink-muted">Or try a sample view</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {lensScenarios.map((scenario) => (
                    <Button
                      key={scenario.id}
                      variant="secondary"
                      size="sm"
                      disabled={phase === "analyzing"}
                      onClick={() => analyze({ kind: "sample", scenario })}
                    >
                      {scenario.label}
                    </Button>
                  ))}
                </div>
                {phase === "analyzing" ? (
                  <Button variant="ghost" size="sm" className="mt-4" onClick={reset}>
                    Cancel
                  </Button>
                ) : null}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <Link href="/guide" className={buttonStyles({ variant: "ghost", className: "mt-8 -ml-4" })}>
          <ArrowLeft aria-hidden className="size-4" />
          Back to the guide
        </Link>
      </div>
    </Container>
  );
}
