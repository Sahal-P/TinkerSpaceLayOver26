"use client";

import { Check, Copy, Globe, Share2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";

import { QrCode } from "@/components/qr-code";
import { Button, buttonStyles } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import {
  FlowEmpty,
  DeferredFeature,
} from "@/features/journey/components/flow/flow-empty";
import { ScreenIntro } from "@/features/journey/components/flow/screen-intro";
import { GuideCard } from "@/features/journey/components/share/guide-card";
import { demoJourney } from "@/features/journey/fixtures";
import { unresolvedSteps, useJourney } from "@/features/journey/journey-store";
import { duration, ease } from "@/lib/motion";
import { cn } from "@/lib/utils";

const subscribeNever = () => () => {};

/** Mock share link. The real one comes from the publish API in a later phase. */
function useShareUrl(): string | null {
  return useSyncExternalStore(
    subscribeNever,
    () => `${window.location.origin}/guide?guide=${demoJourney.id}`,
    () => null,
  );
}

const PUBLISH_MS = 1400;

export function ShareScreen() {
  const { state } = useJourney();
  if (!state.draft) return <FlowEmpty />;
  if (!state.routeConfirmed) return <FlowEmpty needsReview />;
  if (state.mode === "live") return <DeferredFeature feature="Sharing" />;
  return <DemoShareScreen />;
}

function DemoShareScreen() {
  const router = useRouter();
  const { state, dispatch } = useJourney();
  const url = useShareUrl();
  const open = unresolvedSteps(state.steps);
  const [published, setPublished] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [done, setDone] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!publishing) return;
    const timer = window.setTimeout(() => {
      setPublishing(false);
      setPublished(true);
      setStatus("Demo publication preview. No guide was saved or published.");
    }, PUBLISH_MS);
    return () => window.clearTimeout(timer);
  }, [publishing]);

  const share = async () => {
    if (!url) return;
    const data = {
      title: demoJourney.title,
      text: `Directions from ${demoJourney.speaker.name}, ready to follow.`,
      url,
    };
    try {
      if (
        typeof navigator.share === "function" &&
        (navigator.canShare?.(data) ?? true)
      ) {
        await navigator.share(data);
        setStatus("Shared.");
      } else {
        await navigator.clipboard.writeText(url);
        setStatus("Link copied to your clipboard.");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setStatus("Couldn't share automatically. Copy the link instead.");
    }
  };

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setStatus("Link copied to your clipboard.");
    } catch {
      setStatus(
        "Copy didn't work here. Tap the link above to select it, then copy.",
      );
    }
  };

  const startOver = () => {
    dispatch({ type: "journey/reset" });
    router.push("/record");
  };

  if (done) {
    return (
      <Container
        size="md"
        className="flex flex-1 flex-col items-center justify-center py-16 text-center"
      >
        <svg viewBox="0 0 96 96" aria-hidden className="size-24">
          <motion.circle
            cx="48"
            cy="48"
            r="44"
            className="fill-none stroke-accent-ink"
            strokeWidth="2"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: duration.cinematic, ease: ease.outSoft }}
          />
          <motion.path
            d="M30 49l12 12 24-26"
            className="fill-none stroke-accent-ink"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{
              duration: duration.slow,
              delay: 0.6,
              ease: ease.outSoft,
            }}
          />
        </svg>
        <h1 className="mt-8 font-display text-headline text-balance">
          Your guide is ready to travel.
        </h1>
        <p className="mt-5 max-w-md text-lg text-ink-muted">
          This demo previews sharing. No custom guide is saved. Explore{" "}
          {demoJourney.speaker.name}&rsquo;s directions, landmark by landmark,
          in their own language.
        </p>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Button size="lg" onClick={startOver}>
            Record another route
          </Button>
          <Link
            href="/"
            className={buttonStyles({ variant: "secondary", size: "lg" })}
          >
            Back to home
          </Link>
        </div>
        <Link
          href="/guide"
          className="mt-6 text-sm text-ink-muted underline decoration-1 underline-offset-4 hover:text-ink"
        >
          Open the guide again
        </Link>
      </Container>
    );
  }

  return (
    <Container
      size="xl"
      className="grid flex-1 gap-10 py-8 sm:py-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-start lg:gap-16 lg:py-16"
    >
      <div className="order-2 lg:order-1">
        <GuideCard steps={state.steps} />
      </div>

      <div className="order-1 lg:sticky lg:top-36 lg:order-2">
        <ScreenIntro title="Pass the directions on.">
          Publish the guide to get a link and QR code. Only what you confirmed
          is shared; the recording and transcript stay private.
        </ScreenIntro>

        <AnimatePresence mode="wait" initial={false}>
          {published ? (
            <motion.section
              key="published"
              aria-label="Share the guide"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: duration.slow, ease: ease.outSoft }}
              className="mt-8 rounded-panel bg-surface-raised p-6 ring-1 ring-line"
            >
              <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
                <div className="size-44 shrink-0 rounded-card bg-qr-paper p-2 ring-1 ring-line">
                  {url ? (
                    <QrCode
                      value={url}
                      label="QR code that opens this guide"
                      className="size-full"
                    />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1 text-center sm:text-left">
                  <p className="caps flex items-center justify-center gap-2 text-positive sm:justify-start">
                    <Globe aria-hidden className="size-3.5" />
                    Published
                  </p>
                  <p className="mt-2 font-display text-xl">
                    Scan to follow along
                  </p>
                  <input
                    readOnly
                    aria-label="Share link"
                    value={url ?? ""}
                    onFocus={(event) => event.currentTarget.select()}
                    className="mt-2 w-full truncate rounded-lg bg-transparent font-mono text-xs text-ink-muted"
                  />
                </div>
              </div>
              <div className="mt-6 grid gap-2 sm:grid-cols-2">
                <Button size="lg" onClick={share}>
                  <Share2 aria-hidden className="size-5" />
                  Share guide
                </Button>
                <Button variant="secondary" size="lg" onClick={copy}>
                  <Copy aria-hidden className="size-4" />
                  Copy link
                </Button>
              </div>
              <Button
                variant="ghost"
                className="mt-4 w-full"
                onClick={() => setDone(true)}
              >
                <Check aria-hidden className="size-4" />
                Finish
              </Button>
            </motion.section>
          ) : (
            <motion.section
              key="publish"
              aria-label="Publish the guide"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: duration.slow, ease: ease.outSoft }}
              className="mt-8 rounded-panel bg-surface-raised p-6 ring-1 ring-line"
            >
              {open.length ? (
                <div className="rounded-card bg-caution-soft p-4">
                  <p className="font-medium text-caution">
                    {open.length} {open.length === 1 ? "step is" : "steps are"}{" "}
                    still uncertain
                  </p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                    {open.map((step) => (
                      <li key={step.id}>{step.note ?? step.instruction}</li>
                    ))}
                  </ul>
                  <label className="mt-4 flex cursor-pointer items-start gap-3 text-sm">
                    <input
                      type="checkbox"
                      checked={acknowledged}
                      onChange={(event) =>
                        setAcknowledged(event.target.checked)
                      }
                      className="mt-0.5 size-5 shrink-0 accent-accent-ink"
                    />
                    I understand these steps will be shared with their warnings.
                  </label>
                </div>
              ) : (
                <p className="flex items-center gap-2 text-sm text-positive">
                  <Check aria-hidden className="size-4" />
                  Every step is clear or checked by you.
                </p>
              )}
              <Button
                size="lg"
                className="mt-6 w-full"
                disabled={publishing || (open.length > 0 && !acknowledged)}
                onClick={() => setPublishing(true)}
              >
                <Globe
                  aria-hidden
                  className={cn(
                    "size-5",
                    publishing && "motion-safe:animate-spin",
                  )}
                />
                {publishing ? "Publishing…" : "Publish guide"}
              </Button>
              <p className="mt-3 text-center text-xs text-ink-muted">
                Demo: nothing leaves this device yet.
              </p>
            </motion.section>
          )}
        </AnimatePresence>

        <p
          aria-live="polite"
          className="mt-4 min-h-5 text-center text-sm text-ink-muted sm:text-left"
        >
          {status}
        </p>
      </div>
    </Container>
  );
}
