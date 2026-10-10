"use client";
import { LoaderCircle, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { narrationText, speechLanguageSchema, type NarrationInput } from "@/contracts/speech";
import { useGuideVoice } from "@/features/journey/use-guide-voice";

export function VoiceControls({ current, next, demo }: { current: NarrationInput | null; next: NarrationInput | null; demo: boolean }) {
  const voice = useGuideVoice(current, next);
  return (
    <div className="mt-5 rounded-card border border-line p-4" aria-label="Voice guidance">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" size="icon-lg" aria-label={voice.enabled ? "Turn off voice guidance" : "Turn on voice guidance"} aria-pressed={voice.enabled} onClick={voice.toggle} disabled={!current && !voice.enabled}>
          {voice.status === "loading" ? <LoaderCircle aria-hidden className="size-5 motion-safe:animate-spin" /> : voice.enabled ? <Volume2 aria-hidden className="size-5" /> : <VolumeX aria-hidden className="size-5" />}
        </Button>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          Voice language
          <select className="min-h-11 rounded-xl border border-line bg-surface px-3 text-ink" value={voice.language} onChange={event => {
            const result = speechLanguageSchema.safeParse(event.target.value); if (result.success) voice.changeLanguage(result.data);
          }}>
            <option value="en">English</option><option value="ml">മലയാളം</option><option value="hi">हिन्दी</option>
          </select>
        </label>
        {voice.enabled && current && voice.status !== "loading" ? (
          <Button variant="ghost" size="sm" disabled={voice.coolingDown || (voice.status === "error" && !voice.error?.retryable)} onClick={voice.play}>
            <RotateCcw aria-hidden className="size-4" />{voice.status === "blocked" || voice.status === "paused" ? "Tap to play" : voice.status === "error" ? "Retry voice" : "Replay step"}
          </Button>
        ) : null}
      </div>
      <p className="mt-2 text-xs text-ink-muted" role="status">
        {voice.status === "loading" ? "Preparing voice guidance…" : voice.status === "playing" ? "Reading this step." : voice.status === "blocked" ? "Your browser needs a tap to play audio." : voice.status === "paused" ? "Voice paused while the page was hidden." : "Enable voice to read each selected step. Navigation stays manual."}
      </p>
      {!voice.enabled ? <p className="mt-2 text-xs text-ink-muted">{demo ? "Demo narration calls Google Gemini when enabled." : "Voice sends this step and its warnings to Google Gemini."} Generated clips stay in session memory.</p> : null}
      {voice.error ? <div role="alert" className="mt-3 text-sm"><p>{voice.error.message}</p>{voice.error.requestId ? <p className="mt-1 break-all font-mono text-xs">Request: {voice.error.requestId}</p> : null}{voice.coolingDown ? <p className="mt-1 text-xs">Wait before retrying.</p> : null}</div> : null}
      {voice.prepared && voice.language !== "en" ? <details className="mt-3 text-sm"><summary className="min-h-11 cursor-pointer py-3">Translated voice text</summary><p lang={voice.language} className="leading-relaxed">{narrationText(voice.prepared.sections)}</p><p className="mt-2 text-xs text-ink-muted">Machine translation. Names and distance references stay unchanged; check uncertain details.</p></details> : null}
    </div>
  );
}
