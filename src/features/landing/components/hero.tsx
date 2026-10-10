"use client";

import { ArrowRight, Mic } from "lucide-react";
import { useScroll } from "motion/react";
import Link from "next/link";
import { useRef } from "react";

import { JourneyScene } from "@/components/scene/journey-scene";
import { arrowNudge, buttonStyles, textLinkStyles } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { cn } from "@/lib/utils";

/**
 * Split opener: server-rendered copy on the left (it paints before the 3D scene loads),
 * the miniature island in a coastline-shaped frame on the right. Scrolling dollies the camera.
 */
export function Hero() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });

  return (
    <section ref={ref} aria-labelledby="hero-title" className="relative isolate lg:min-h-[max(42rem,100svh)]">
      <Container size="xl" className="pt-32 pb-12 sm:pt-36 lg:flex lg:min-h-[max(42rem,100svh)] lg:items-center lg:py-28">
        <div className="max-w-xl lg:w-[44%] lg:max-w-none xl:w-[42%]">
          <h1 id="hero-title" className="font-display text-display">
            <span className="block motion-safe:animate-rise">Ask a local,</span>{" "}
            <span className="block text-accent-ink italic motion-safe:animate-rise [animation-delay:120ms]">follow the lens.</span>
          </h1>
          <p className="mt-7 max-w-md text-lg text-pretty text-ink-muted motion-safe:animate-rise [animation-delay:220ms]">
            Record the directions a local gives you, in any language. Local to Lens turns them into a landmark-by-landmark guide
            you can follow, check with your camera, and share.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-x-8 gap-y-3 motion-safe:animate-rise [animation-delay:320ms]">
            <Link href="/record" className={buttonStyles({ size: "lg" })}>
              <Mic aria-hidden className="size-5" />
              Start recording
            </Link>
            <Link href="/guide" className={textLinkStyles()}>
              Try the demo guide
              <ArrowRight aria-hidden className={cn("size-4", arrowNudge)} />
            </Link>
          </div>

          <figure className="mt-14 flex max-w-md items-start gap-4 border-t border-line pt-7 motion-safe:animate-rise [animation-delay:420ms] lg:mt-20">
            <span
              aria-hidden
              className="grid size-12 shrink-0 place-items-center rounded-full bg-accent-soft font-display text-lg font-semibold text-accent-ink"
            >
              DA
            </span>
            <div>
              <blockquote>
                <p lang="pt" className="font-display text-lg leading-snug italic">
                  &ldquo;Na igreja pequena com a torre do sino, vira à esquerda.&rdquo;
                </p>
                <p className="mt-1 text-sm">At the little church with the bell tower, turn left.</p>
              </blockquote>
              <figcaption className="mt-2 text-sm text-ink-muted">Dona Amélia, café owner in Alfama</figcaption>
            </div>
          </figure>
        </div>
      </Container>

      {/* The coastline frame: full-bleed under the copy on phones, the right half of the screen from lg. */}
      <div className="relative h-[min(60svh,34rem)] mask-coast-sm sm:h-[min(64svh,40rem)] lg:absolute lg:inset-y-0 lg:right-0 lg:h-auto lg:w-[54%] lg:mask-coast xl:w-[56%]">
        <JourneyScene
          mode="hero"
          scrollProgress={scrollYProgress}
          label="A miniature island town in a hazy sea: a teal route winds from a tram past a bakery, a stone arch, a bell tower and a castle wall to a viewpoint marked with a pin."
          className="absolute inset-0"
        />
      </div>
    </section>
  );
}
