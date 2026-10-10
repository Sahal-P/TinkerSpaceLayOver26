import { ArrowRight, Mic } from "lucide-react";
import Link from "next/link";

import { Reveal } from "@/components/reveal";
import { arrowNudge, buttonStyles, textLinkStyles } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { cn } from "@/lib/utils";

export function ClosingCta() {
  return (
    <section aria-labelledby="closing-title" className="py-28 sm:py-40">
      <Container size="md" className="text-center">
        <Reveal>
          <h2 id="closing-title" className="font-display text-headline text-balance">
            The best route starts with a question.
          </h2>
          <p className="mx-auto mt-6 max-w-md text-lg text-pretty text-ink-muted">
            No account needed. The whole journey runs on demo data while the real pipeline is being built.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-x-8 gap-y-3 sm:flex-row">
            <Link href="/record" className={buttonStyles({ size: "lg" })}>
              <Mic aria-hidden className="size-5" />
              Start recording
            </Link>
            <Link href="/guide" className={textLinkStyles()}>
              Explore the demo guide
              <ArrowRight aria-hidden className={cn("size-4", arrowNudge)} />
            </Link>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
