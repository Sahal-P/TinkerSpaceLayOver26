import { BrandMark } from "@/components/brand-mark";
import { ConfidenceBadge } from "@/components/confidence-badge";
import { RouteSketch } from "@/components/route-sketch";
import { demoJourney } from "@/features/journey/fixtures";
import type { Step } from "@/features/journey/schemas";
import { formatDistance } from "@/lib/format";

const recordedOn = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
}).format(new Date(demoJourney.recordedAt));

/** The guide as a keepsake: an editorial postcard with the route map. */
export function GuideCard({ steps }: { steps: ReadonlyArray<Step> }) {
  const meters = steps.reduce((sum, step) => sum + (step.distanceM ?? 0), 0);
  const first = steps[0]?.landmark ?? demoJourney.from;
  const last = steps.at(-1)?.landmark ?? demoJourney.to;

  return (
    <article
      aria-labelledby="guide-card-title"
      className="overflow-hidden rounded-panel bg-surface-raised shadow-lifted ring-1 ring-line"
    >
      <div className="caps flex items-center justify-between border-b border-line px-6 py-4 text-ink-muted">
        <span className="flex items-center gap-2">
          <BrandMark className="size-5 text-ink" />
          Local to Lens · Guide
        </span>
        <span>{recordedOn}</span>
      </div>
      <div className="p-6 sm:p-8">
        <p className="caps text-accent-ink">
          {demoJourney.area}, {demoJourney.city}
        </p>
        <h2
          id="guide-card-title"
          className="mt-3 font-display text-title text-balance"
        >
          {demoJourney.title}
        </h2>
        <p className="mt-2 text-ink-muted">
          {first} <span aria-hidden>→</span>
          <span className="sr-only">to</span> {last}
        </p>

        <div className="mt-6 aspect-[4/3] overflow-hidden rounded-card bg-surface ring-1 ring-line">
          <RouteSketch
            variant="map"
            stops={steps.map((step) => step.anchor)}
            title={`Route map with ${steps.length} stops`}
          />
        </div>

        <dl className="mt-6 grid grid-cols-3 border-y border-line text-center">
          {[
            ["Spoken references", formatDistance(meters)],
            ["Travel time", "Not estimated"],
            ["Steps", String(steps.length)],
          ].map(([label, value]) => (
            <div
              key={label}
              className="border-l border-line py-4 first:border-l-0"
            >
              <dt className="caps text-ink-muted">{label}</dt>
              <dd className="mt-1 font-display text-2xl">{value}</dd>
            </div>
          ))}
        </dl>

        <ol className="mt-6 space-y-3">
          {steps.slice(0, 3).map((step, index) => (
            <li key={step.id} className="flex items-start gap-3 text-sm">
              <span className="w-4 text-ink-muted tabular-nums">
                {index + 1}
              </span>
              <span className="flex-1">{step.instruction}</span>
              {step.confidence !== "high" ? (
                <ConfidenceBadge
                  level={step.confidence}
                  reviewed={step.reviewed}
                />
              ) : null}
            </li>
          ))}
          {steps.length > 3 ? (
            <li className="pl-8 text-sm text-ink-muted">
              and {steps.length - 3} more steps
            </li>
          ) : null}
        </ol>

        <p className="mt-6 border-t border-line pt-4 text-sm text-ink-muted">
          Directions by {demoJourney.speaker.name}, scripted in English.
          Scripted demo preview; no AI call or real publication took place.
        </p>
      </div>
    </article>
  );
}
