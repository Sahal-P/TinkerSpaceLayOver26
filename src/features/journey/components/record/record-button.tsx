"use client";

import { Mic, Square } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils";

/** The big round record control. While recording it becomes a stop button with a breathing halo. */
export function RecordButton({ recording, disabled = false, onClick }: { recording: boolean; disabled?: boolean; onClick: () => void }) {
  const reduceMotion = useReducedMotion();

  return (
    <div className="relative grid size-28 place-items-center">
      {recording && !reduceMotion
        ? [0, 0.8].map((delay) => (
            <motion.span
              key={delay}
              aria-hidden
              className="absolute inset-0 rounded-full bg-accent"
              initial={{ opacity: 0.35, scale: 0.75 }}
              animate={{ opacity: 0, scale: 1.25 }}
              transition={{ duration: 1.6, repeat: Infinity, delay, ease: "easeOut" }}
            />
          ))
        : null}
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={recording ? "Stop recording" : "Start recording"}
        className={cn(
          "relative grid size-22 place-items-center rounded-full shadow-lifted transition-[background-color,transform,opacity] duration-300 ease-out-soft active:scale-95",
          "disabled:pointer-events-none disabled:opacity-40 disabled:shadow-none",
          recording ? "bg-ink text-surface" : "bg-accent text-on-accent hover:bg-accent-hover",
        )}
      >
        {recording ? <Square aria-hidden className="size-7 fill-current" /> : <Mic aria-hidden className="size-8" />}
      </button>
    </div>
  );
}
