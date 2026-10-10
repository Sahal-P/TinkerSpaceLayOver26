"use client";
import { useState } from "react";
import { ChoiceChips } from "@/components/ui/choice-chips";
import { HighlightedText } from "@/features/journey/components/highlighted-text";
import { useJourney } from "@/features/journey/journey-store";
import { detectedLanguageLabel } from "@/features/journey/presentation";
import { formatClock } from "@/lib/format";

type View = "both" | "original" | "translation";
export function TranscriptPanel() {
  const [view, setView] = useState<View>("both");
  const { state } = useJourney();
  const guide = state.draft;
  if (!guide) return null;
  const singleLanguage =
    guide.languages.detected.length === 1
      ? guide.languages.detected[0]?.code
      : undefined;
  const views = [
    { value: "both", label: "Both" },
    { value: "original", label: "Original" },
    { value: "translation", label: "English" },
  ] as const;
  return (
    <section
      aria-labelledby="transcript-title"
      className="rounded-panel bg-surface-raised p-5 ring-1 ring-line sm:p-8"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 id="transcript-title" className="font-display text-2xl">
            Transcript
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            {detectedLanguageLabel(guide)} ·{" "}
            {state.mode === "demo"
              ? "Scripted demo"
              : "Detected from the recording"}
          </p>
        </div>
        <ChoiceChips
          name="transcript-view"
          legend="Transcript language"
          options={views}
          value={view}
          onChange={setView}
        />
      </div>
      <ol className="mt-6 border-t border-line">
        {guide.transcript.segments.map((segment) => {
          const grounded = guide.steps.filter(
            (step) =>
              step.source === "audio" &&
              step.evidence &&
              segment.original.includes(step.evidence.original),
          );
          return (
            <li
              key={segment.id}
              className="border-b border-line py-5 last:border-b-0"
            >
              {segment.startSec !== null ? (
                <span className="font-mono text-xs text-ink-muted">
                  {formatClock(segment.startSec)}
                </span>
              ) : null}
              <div className="space-y-2 [overflow-wrap:anywhere]">
                {view !== "translation" ? (
                  <p
                    lang={singleLanguage}
                    className={
                      view === "both"
                        ? "font-display text-ink-muted italic"
                        : "text-lg leading-snug"
                    }
                  >
                    <HighlightedText
                      text={segment.original}
                      phrases={grounded.flatMap((step) =>
                        step.landmark.spoken ? [step.landmark.spoken] : [],
                      )}
                    />
                  </p>
                ) : null}
                {view !== "original" ? (
                  <p lang="en" className="text-lg leading-snug">
                    <HighlightedText
                      text={segment.translation}
                      phrases={grounded.flatMap((step) =>
                        step.landmark.label ? [step.landmark.label] : [],
                      )}
                    />
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
