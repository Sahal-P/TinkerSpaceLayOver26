import { ArrowRight } from "lucide-react";

import { buttonStyles } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { HeroVisual } from "@/features/landing/components/hero-visual";

// Text stays server-rendered and static so it paints immediately; only the visual animates.
export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="py-12 sm:py-20">
      <Container className="grid items-center gap-12 md:grid-cols-[1.1fr_1fr]">
        <div>
          <p className="text-sm font-medium tracking-wide text-accent uppercase">Your trip, your guide</p>
          <h1
            id="hero-title"
            className="mt-4 font-display text-5xl leading-[1.05] font-semibold tracking-tight text-balance sm:text-6xl"
          >
            Your trip, told like a local.
          </h1>
          <p className="mt-6 max-w-prose text-lg text-pretty text-ink-muted">
            Record voice notes and short clips as you explore. Local to Lens shapes them into a guide you
            can keep, revisit, and share.
          </p>
          <a href="#how-it-works" className={buttonStyles({ size: "lg", className: "mt-10" })}>
            See how it works
            <ArrowRight aria-hidden className="size-5" />
          </a>
        </div>
        <HeroVisual />
      </Container>
    </section>
  );
}
