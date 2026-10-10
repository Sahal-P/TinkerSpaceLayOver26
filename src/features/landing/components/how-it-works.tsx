import { Mic, Share2, Sparkles } from "lucide-react";

import { Container } from "@/components/ui/container";

const steps = [
  {
    icon: Mic,
    title: "Record",
    body: "Capture voice notes and short clips as you wander. No typing on the go.",
  },
  {
    icon: Sparkles,
    title: "Shape",
    body: "Gemini organizes your moments into places, tips, and a route that makes sense.",
  },
  {
    icon: Share2,
    title: "Share",
    body: "Get a clean, personal guide to keep, revisit, or send to a friend.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" aria-labelledby="how-it-works-title" className="scroll-mt-6 py-16 sm:py-24">
      <Container>
        <h2 id="how-it-works-title" className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          How it works
        </h2>
        <ol className="mt-10 grid gap-4 sm:grid-cols-3">
          {steps.map(({ icon: Icon, title, body }, index) => (
            <li key={title} className="rounded-card bg-surface-raised p-6 ring-1 ring-line">
              <div className="flex items-center justify-between">
                <span className="grid size-11 place-items-center rounded-full bg-accent-soft text-accent">
                  <Icon aria-hidden className="size-5" />
                </span>
                <span className="font-display text-sm text-ink-muted">0{index + 1}</span>
              </div>
              <h3 className="mt-6 text-lg font-semibold">{title}</h3>
              <p className="mt-2 text-ink-muted">{body}</p>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}
