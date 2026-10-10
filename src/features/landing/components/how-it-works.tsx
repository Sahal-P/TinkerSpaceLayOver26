"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState, type ReactNode } from "react";

import { PhoneFrame } from "@/components/phone-frame";
import { Container } from "@/components/ui/container";
import { GuidePreview, ProcessingPreview, RecordPreview, SharePreview } from "@/features/landing/components/phone-screens";
import { duration, ease } from "@/lib/motion";
import { cn } from "@/lib/utils";

const chapters: Array<{ id: string; label: string; title: string; body: string; screen: ReactNode }> = [
  {
    id: "record",
    label: "Record",
    title: "Record the moment",
    body: "Ask, then listen. Tap record while a local explains the way, in their own words and their own language.",
    screen: <RecordPreview />,
  },
  {
    id: "shape",
    label: "Shape",
    title: "Gemini shapes the route",
    body: "The recording is transcribed, translated and turned into landmark-by-landmark steps, with every uncertain detail flagged for you to check.",
    screen: <ProcessingPreview />,
  },
  {
    id: "follow",
    label: "Follow",
    title: "Follow landmark by landmark",
    body: "Big, glanceable directions with an illustrated route. When a step feels unclear, point your camera at it for a Lens check.",
    screen: <GuidePreview />,
  },
  {
    id: "share",
    label: "Share",
    title: "Pass it on",
    body: "Publish the guide and share it with a link or QR code, so the next traveler gets the same local knowledge.",
    screen: <SharePreview />,
  },
];

/** Scroll story: chapters scroll past while a sticky phone shows the matching screen. */
export function HowItWorks() {
  const [active, setActive] = useState(0);

  return (
    <section id="how-it-works" aria-labelledby="how-title" className="scroll-mt-8 bg-surface-sunken py-24 sm:py-32">
      <Container size="xl">
        <div className="max-w-2xl">
          <p className="caps text-ink-muted">How it works</p>
          <h2 id="how-title" className="mt-5 font-display text-headline text-balance">
            From one conversation to a guide you can walk.
          </h2>
        </div>

        <div className="mt-16 lg:mt-8 lg:grid lg:grid-cols-2 lg:gap-16">
          <div className="hidden lg:block">
            <div className="sticky top-0 flex h-svh items-center justify-center">
              <PhoneFrame className="w-72">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={active}
                    className="h-full"
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -16 }}
                    transition={{ duration: duration.base, ease: ease.outSoft }}
                  >
                    {chapters[active]?.screen}
                  </motion.div>
                </AnimatePresence>
              </PhoneFrame>
            </div>
          </div>

          <ol>
            {chapters.map((chapter, index) => (
              <motion.li
                key={chapter.id}
                onViewportEnter={() => setActive(index)}
                viewport={{ amount: 0.6 }}
                className={cn(
                  "flex flex-col justify-center border-t border-line py-14 transition-opacity duration-500 lg:min-h-[80svh] lg:py-0",
                  active === index ? "lg:opacity-100" : "lg:opacity-35",
                )}
              >
                <p className="caps flex items-center gap-2 text-accent-ink">
                  <span aria-hidden className="size-1.5 rounded-full bg-current" />
                  {chapter.label}
                </p>
                <h3 className="mt-4 font-display text-title">{chapter.title}</h3>
                <p className="mt-4 max-w-md text-lg text-pretty text-ink-muted">{chapter.body}</p>
                <div className="mt-10 lg:hidden">
                  <PhoneFrame className="w-64">{chapter.screen}</PhoneFrame>
                </div>
              </motion.li>
            ))}
          </ol>
        </div>
      </Container>
    </section>
  );
}
