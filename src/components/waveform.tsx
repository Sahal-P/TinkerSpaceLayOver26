"use client";

import { useAnimationFrame, useReducedMotion } from "motion/react";
import { useRef } from "react";

import { seededRandom } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Deterministic bar levels (0–1) that look like speech: phrases with pauses. */
export function speechLevels(count: number, seed = 7): number[] {
  const random = seededRandom(seed);
  return Array.from({ length: count }, (_, index) => {
    const phrase = 0.55 + 0.45 * Math.sin(index / 3.1) * Math.sin(index / 7.7 + 1);
    return Math.min(1, Math.max(0.12, phrase * (0.55 + random() * 0.6)));
  });
}

type WaveformProps = {
  levels: readonly number[];
  /** Live: bars react as if someone is speaking. */
  live?: boolean;
  /** Playback position (0–1); played bars take the accent color. */
  progress?: number;
  className?: string;
};

export function Waveform({ levels, live = false, progress, className }: WaveformProps) {
  const barsRef = useRef<Array<HTMLSpanElement | null>>([]);
  const reduceMotion = useReducedMotion();

  useAnimationFrame((time) => {
    if (!live) return;
    barsRef.current.forEach((bar, index) => {
      if (!bar) return;
      const level = levels[index] ?? 0.3;
      const energy = reduceMotion
        ? 0.6
        : 0.5 + 0.5 * Math.sin(time / 150 + index * 0.7) * Math.cos(time / 330 + index * 1.3);
      bar.style.transform = `scaleY(${Math.max(0.08, level * (0.3 + energy * 0.8))})`;
    });
  });

  return (
    // Remount when switching modes so React re-applies the static bar heights.
    <div key={live ? "live" : "static"} aria-hidden className={cn("flex h-24 items-center gap-[3px]", className)}>
      {levels.map((level, index) => {
        const played = progress !== undefined && index / levels.length < progress;
        return (
          <span
            key={index}
            ref={(element) => {
              barsRef.current[index] = element;
            }}
            className={cn(
              "h-full min-w-0 flex-1 rounded-full transition-colors duration-150",
              live || played ? "bg-accent-ink" : progress === undefined ? "bg-ink" : "bg-line-strong",
            )}
            style={{ transform: `scaleY(${live ? 0.1 : level})` }}
          />
        );
      })}
    </div>
  );
}
