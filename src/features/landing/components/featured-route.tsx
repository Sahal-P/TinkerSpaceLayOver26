import { ArrowRight, AudioLines } from "lucide-react";
import Link from "next/link";

import { Photo } from "@/components/photo";
import { Reveal } from "@/components/reveal";
import { arrowNudge, buttonStyles, textLinkStyles } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import type { PhotoName } from "@/config/photos";
import { cn } from "@/lib/utils";

type StepCard = {
  /** 1-based step number in the demo guide. */
  step: number;
  move: string;
  title: string;
  /** The speaker's own words for the landmark. */
  quote: string;
  distance: string;
  /** Where in the recording the step comes from. */
  at: string;
  photo: PhotoName;
};

const cards: StepCard[] = [
  { step: 1, move: "Start", title: "Yellow tram stop", quote: "paragem do elétrico amarelo", distance: "Start here", at: "0:00", photo: "tramStreet" },
  { step: 2, move: "Straight on", title: "Bakery with blue tiles", quote: "pastelaria com os azulejos azuis", distance: "120 m", at: "0:07", photo: "azulejos" },
  { step: 4, move: "Turn left", title: "Church with the bell tower", quote: "igreja pequena com a torre do sino", distance: "150 m", at: "0:23", photo: "bellTowers" },
];

const facts = [
  { label: "Steps", value: "6" },
  { label: "Distance", value: "650 m" },
  { label: "On foot", value: "9 min" },
];

/** The demo guide as a bento of landmark photos, plus a feature panel for the whole route. */
export function FeaturedRoute() {
  return (
    <section id="route" aria-labelledby="route-title" className="scroll-mt-8 py-24 sm:py-32">
      <Container size="xl">
        <Reveal className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <h2 id="route-title" className="font-display text-headline text-balance">
              Dona Amélia&rsquo;s route
            </h2>
            <p className="mt-5 max-w-lg text-lg text-pretty text-ink-muted">
              Forty-seven seconds of Portuguese, recorded outside her café. Six landmarks in the order she named them,
              translated, with a note wherever she wasn&rsquo;t sure.
            </p>
          </div>
          <Link href="/guide" className={textLinkStyles({ className: "shrink-0" })}>
            See the full guide
            <ArrowRight aria-hidden className={cn("size-4", arrowNudge)} />
          </Link>
        </Reveal>

        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:mt-14 lg:grid-cols-12 lg:grid-rows-[repeat(2,minmax(17.5rem,auto))] lg:gap-5">
          {cards.map((card, index) => (
            <li key={card.step} className={cn(index === 0 ? "sm:col-span-2 lg:col-span-5 lg:row-span-2" : "lg:col-span-7")}>
              <StepPhotoCard
                card={card}
                sizes={index === 0 ? "(min-width: 1024px) 40vw, 100vw" : "(min-width: 1024px) 56vw, (min-width: 640px) 50vw, 100vw"}
                className={index === 0 ? "min-h-[30rem] sm:min-h-[34rem] lg:min-h-0" : "min-h-[19rem]"}
              />
            </li>
          ))}
        </ul>

        <Reveal className="mt-4 lg:mt-5">
          <FeaturePanel />
        </Reveal>
      </Container>
    </section>
  );
}

function StepPhotoCard({ card, sizes, className }: { card: StepCard; sizes: string; className?: string }) {
  return (
    <Link
      href={`/guide?step=${card.step}`}
      className={cn(
        "group relative isolate flex h-full flex-col justify-between overflow-hidden rounded-card bg-surface-sunken p-5 text-photo-ink sm:p-6",
        className,
      )}
    >
      <Photo name={card.photo} sizes={sizes} className="-z-20 transition-transform duration-1000 ease-out-soft group-hover:scale-[1.04]" />
      <span aria-hidden className="absolute inset-0 -z-10 bg-linear-to-t from-scrim/90 via-scrim/45 via-45% to-scrim/0 to-80%" />

      <div className="flex items-start justify-between gap-3 text-xs font-medium">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-photo-ink px-3 py-1.5 text-scrim">
          <span aria-hidden className="size-1.5 rounded-full bg-surface-inverse" />
          Clear
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-scrim/50 px-3 py-1.5 tabular-nums">
          <AudioLines aria-hidden className="size-3.5" />
          <span className="sr-only">Said at</span>
          {card.at}
        </span>
      </div>

      <div className="mt-24">
        <p className="caps">
          Step {card.step} · {card.move}
        </p>
        <h3 className="mt-2 font-display text-[1.75rem] leading-tight text-balance">{card.title}</h3>
        <div className="mt-5 flex items-end justify-between gap-4 border-t border-photo-ink/30 pt-4">
          <p lang="pt" className="font-display text-lg leading-snug italic">
            &ldquo;{card.quote}&rdquo;
          </p>
          <span className="shrink-0 text-sm tabular-nums">{card.distance}</span>
        </div>
      </div>
    </Link>
  );
}

function FeaturePanel() {
  return (
    <article
      aria-labelledby="feature-title"
      className="grid overflow-hidden rounded-panel bg-feature p-3 text-on-feature sm:p-4 lg:grid-cols-[1.05fr_1fr]"
    >
      <div className="flex flex-col px-5 pt-7 pb-8 sm:px-8 sm:pt-10 lg:px-10 lg:py-12">
        <p className="caps">Featured guide</p>
        <h3 id="feature-title" className="mt-5 font-display text-headline">
          A morning <em className="italic">in Alfama</em>
        </h3>
        <p className="mt-5 max-w-md text-lg text-pretty">
          From the tram stop up to the Miradouro de Santa Luzia, in Dona Amélia&rsquo;s own words. Two of the six landmarks are
          flagged for a second look.
        </p>
        <dl className="mt-10 grid max-w-md grid-cols-3 border-y border-on-feature/30">
          {facts.map((fact) => (
            <div key={fact.label} className="border-l border-on-feature/30 py-5 pl-5 first:border-l-0 first:pl-0">
              <dt className="caps">{fact.label}</dt>
              <dd className="mt-1 font-display text-2xl whitespace-nowrap tabular-nums sm:text-3xl">{fact.value}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-3 lg:mt-auto lg:pt-12">
          <Link href="/guide" className={buttonStyles({ variant: "light", size: "lg" })}>
            Follow this guide
            <ArrowRight aria-hidden className={cn("size-5", arrowNudge)} />
          </Link>
          <Link href="/review" className={textLinkStyles({ tone: "feature" })}>
            Read the transcript
          </Link>
        </div>
      </div>

      <div className="relative isolate min-h-[22rem] overflow-hidden rounded-[1.125rem] bg-scrim sm:min-h-[26rem]">
        <Photo name="alfamaView" sizes="(min-width: 1024px) 46vw, 100vw" className="-z-10" />
        <span className="absolute top-4 left-4 inline-flex items-center gap-1.5 rounded-full bg-photo-ink px-3 py-1.5 text-xs font-medium text-scrim">
          Destination
        </span>
        <span aria-hidden className="absolute inset-x-0 bottom-0 h-1/3 bg-linear-to-t from-scrim/70 to-scrim/0" />
        <p className="absolute right-5 bottom-5 left-5 font-display text-2xl text-photo-ink">Miradouro de Santa Luzia</p>
      </div>
    </article>
  );
}
