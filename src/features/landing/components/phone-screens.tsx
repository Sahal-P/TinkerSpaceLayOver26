import { Check, Square } from "lucide-react";
import type { ReactNode } from "react";

import { ConfidenceBadge } from "@/components/confidence-badge";
import { DirectionIndicator } from "@/components/direction-indicator";
import { QrCode } from "@/components/qr-code";
import { RouteSketch } from "@/components/route-sketch";
import { Waveform, speechLevels } from "@/components/waveform";

/* Miniature product screens for the "How it works" phone. Presentational only. */

const levels = speechLevels(30, 4);

function Screen({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div aria-hidden className="flex h-full flex-col px-5 pt-14 pb-6 text-left">
      <p className="caps text-ink-muted">{label}</p>
      {children}
    </div>
  );
}

export function RecordPreview() {
  return (
    <Screen label="Record">
      <p className="mt-3 font-display text-2xl leading-tight">
        Ask a local for directions.
      </p>
      <div className="mt-6 flex flex-1 flex-col rounded-card bg-surface-raised p-4 ring-1 ring-line">
        <p className="caps flex items-center gap-2 text-accent-ink">
          <span className="size-1.5 rounded-full bg-accent" />
          Recording
        </p>
        <Waveform levels={levels} progress={0.62} className="mt-8 h-16" />
        <p className="mt-6 text-center font-mono text-4xl font-light tabular-nums">0:31</p>
        <div className="mt-auto grid place-items-center pt-4">
          <span className="grid size-16 place-items-center rounded-full bg-ink text-surface">
            <Square className="size-5 fill-current" />
          </span>
        </div>
      </div>
      <p className="mt-4 text-center text-xs text-ink-muted">Português · auto-detected</p>
    </Screen>
  );
}

export function ProcessingPreview() {
  const stages = ["Transcribing", "Translating", "Finding landmarks", "Building your route"];
  return (
    <Screen label="Shape">
      <p className="mt-3 font-display text-2xl leading-tight">
        Shaping your route…
      </p>
      <ol className="mt-6 border-t border-line">
        {stages.map((stage, index) => (
          <li key={stage} className="flex items-center gap-3 border-b border-line py-3 text-sm">
            <span className={index > 2 ? "flex-1 text-ink-muted" : "flex-1"}>{stage}</span>
            {index < 3 ? (
              <span className="grid size-5 place-items-center rounded-full bg-positive-soft text-positive">
                <Check className="size-3" />
              </span>
            ) : (
              <span className="size-5 rounded-full border-2 border-line-strong border-t-accent" />
            )}
          </li>
        ))}
      </ol>
      <p className="mt-5 text-sm leading-relaxed">
        At the little church with the <span className="underline decoration-accent decoration-2 underline-offset-4">bell tower</span>,
        turn left.
      </p>
      <div className="mt-4 flex flex-wrap gap-1.5">
        <ConfidenceBadge level="high" />
        <ConfidenceBadge level="medium" />
        <ConfidenceBadge level="low" />
      </div>
    </Screen>
  );
}

export function GuidePreview() {
  return (
    <Screen label="Step 4 of 6">
      <div className="mt-3 flex gap-1">
        {[1, 1, 1, 0.5, 0, 0].map((fill, index) => (
          <span key={index} className="h-1 flex-1 overflow-hidden rounded-full bg-line">
            <span className="block h-full origin-left rounded-full bg-accent" style={{ transform: `scaleX(${fill})` }} />
          </span>
        ))}
      </div>
      <div className="mt-8 flex items-center gap-4">
        <DirectionIndicator direction="left" className="size-20 sm:size-20" />
        <div>
          <p className="caps text-accent-ink">Turn left</p>
          <p className="font-display text-4xl">150 m</p>
        </div>
      </div>
      <p className="mt-6 font-display text-2xl leading-tight">Turn left at the little church with the bell tower.</p>
      <div className="mt-auto grid grid-cols-[auto_1fr] gap-2">
        <span className="grid size-11 place-items-center rounded-full ring-1 ring-line-strong">←</span>
        <span className="grid h-11 place-items-center rounded-full bg-accent text-sm font-medium text-on-accent">Next step</span>
      </div>
    </Screen>
  );
}

export function SharePreview() {
  return (
    <Screen label="Share">
      <div className="mt-3 rounded-card bg-surface-raised p-3 ring-1 ring-line">
        <div className="aspect-[4/3] overflow-hidden rounded-xl bg-surface">
          <RouteSketch variant="map" />
        </div>
        <p className="mt-3 font-display text-lg leading-tight">From the tram stop to the miradouro</p>
        <p className="mt-1 text-xs text-ink-muted">650 m · 9 min · 6 steps</p>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <QrCode value="Local to Lens demo guide: Alfama" label="Sample QR code" className="size-24 shrink-0 p-1" />
        <p className="text-sm text-ink-muted">Scan to follow Dona Amélia&rsquo;s directions.</p>
      </div>
      <span className="mt-auto grid h-11 place-items-center rounded-full bg-accent text-sm font-medium text-on-accent">Share guide</span>
    </Screen>
  );
}
