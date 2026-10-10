import { Check } from "lucide-react";

import { Parallax } from "@/components/parallax";
import { Photo } from "@/components/photo";
import { Reveal } from "@/components/reveal";
import { Container } from "@/components/ui/container";
import { Viewfinder } from "@/components/viewfinder";
import { cn } from "@/lib/utils";

const levels = [
  { label: "Clear", dot: "bg-positive", body: "The speaker was specific. Follow with confidence." },
  { label: "Check this", dot: "bg-caution", body: "A detail was vague. The guide tells you which one." },
  { label: "Unsure", dot: "bg-critical", body: "They changed their mind or the audio was unclear. Use Lens check." },
];

export function LensFeature() {
  return (
    <section id="lens" aria-labelledby="lens-title" className="scroll-mt-8 bg-surface-inverse py-24 text-ink-inverse sm:py-32">
      <Container size="xl" className="grid items-center gap-16 lg:grid-cols-2 lg:gap-24">
        <Reveal>
          <p className="caps text-ink-inverse-muted">Lens check</p>
          <h2 id="lens-title" className="mt-5 font-display text-headline text-balance">
            The first staircase, or the second?
          </h2>
          <p className="mt-6 max-w-lg text-lg text-pretty text-ink-inverse-muted">
            Dona Amélia wasn&rsquo;t sure, and the guide says so. Point your camera at the steps in front of you: Lens check
            compares them with what she described and tells you plainly how sure it is.
          </p>
          <dl className="mt-12 border-t border-line-inverse">
            {levels.map((level) => (
              <div key={level.label} className="grid gap-2 border-b border-line-inverse py-5 sm:grid-cols-[9rem_1fr] sm:gap-6">
                <dt className="flex items-center gap-2.5 font-medium">
                  <span aria-hidden className={cn("size-2 rounded-full", level.dot)} />
                  {level.label}
                </dt>
                <dd className="text-ink-inverse-muted">{level.body}</dd>
              </div>
            ))}
          </dl>
        </Reveal>

        <Parallax offset={40}>
          <Viewfinder
            topLeft="Lens check"
            topRight="Step 5"
            className="mx-auto aspect-[3/4] w-full max-w-md"
            bottom={
              <div className="flex items-center justify-between rounded-xl bg-surface-raised px-4 py-3 text-ink">
                <span className="flex items-center gap-2 font-medium">
                  <Check aria-hidden className="size-4 text-positive" />
                  Looks like the right place
                </span>
                <span className="font-mono text-sm tabular-nums">92%</span>
              </div>
            }
          >
            <Photo name="tiledSteps" sizes="(min-width: 1024px) 28rem, 90vw" />
          </Viewfinder>
        </Parallax>
      </Container>
    </section>
  );
}
