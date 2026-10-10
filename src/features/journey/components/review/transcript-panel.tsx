"use client";

import { useState } from "react";

import { ChoiceChips } from "@/components/ui/choice-chips";
import { HighlightedText } from "@/features/journey/components/highlighted-text";
import { demoJourney } from "@/features/journey/fixtures";
import { formatClock } from "@/lib/format";

type View = "both" | "original" | "translation";

const views = [
  { value: "both", label: "Both" },
  { value: "original", label: "Português", lang: "pt" },
  { value: "translation", label: "English" },
] as const;

/** The recording as text: original words and translated directions, landmarks underlined. */
export function TranscriptPanel() {
  const [view, setView] = useState<View>("both");
  const journey = demoJourney;

  return (
    <section aria-labelledby="transcript-title" className="rounded-panel bg-surface-raised p-5 ring-1 ring-line sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 id="transcript-title" className="font-display text-2xl">
            Transcript
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            {journey.speaker.name}, who {journey.speaker.role} · {journey.sourceLanguage.label} · {formatClock(journey.durationSec)}
          </p>
        </div>
        <ChoiceChips name="transcript-view" legend="Transcript language" options={views} value={view} onChange={setView} />
      </div>

      <ol className="mt-6 border-t border-line">
        {journey.transcript.map((segment) => (
          <li key={segment.id} className="grid grid-cols-[3rem_1fr] gap-3 border-b border-line py-5 last:border-b-0">
            <span className="pt-1 font-mono text-xs text-ink-muted tabular-nums">{formatClock(segment.startSec)}</span>
            <div className="space-y-2">
              {view !== "translation" ? (
                <p lang="pt" className={view === "both" ? "font-display text-ink-muted italic" : "text-lg leading-snug"}>
                  <HighlightedText text={segment.original} phrases={segment.highlights.map((h) => h.original)} />
                </p>
              ) : null}
              {view !== "original" ? (
                <p className="text-lg leading-snug">
                  <HighlightedText text={segment.translation} phrases={segment.highlights.map((h) => h.translation)} />
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
