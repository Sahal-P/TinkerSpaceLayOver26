"use client";

import { MapPin, Sparkles } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

import { enterTransition } from "@/lib/motion";

const stops = ["Custard tarts at the corner bakery", "Sunset from the miradouro", "Tram 28 through Alfama"];

/** Decorative preview of a recording becoming a guide. Hidden from assistive tech. */
export function HeroVisual() {
  const reduceMotion = useReducedMotion();

  return (
    <div aria-hidden className="mx-auto w-full max-w-sm select-none">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={enterTransition}
        className="rounded-card bg-surface-raised p-4 shadow-soft ring-1 ring-line"
      >
        <div className="flex items-center gap-2 text-xs font-medium text-ink-muted">
          <motion.span
            className="size-2 rounded-full bg-accent"
            animate={reduceMotion ? undefined : { opacity: [1, 0.3, 1] }}
            transition={{ duration: 1.6, repeat: Infinity }}
          />
          Recording · 00:42
        </div>
        <p className="mt-2 text-sm">“The best custard tarts are at the bakery by the tram stop…”</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...enterTransition, delay: 0.3 }}
        className="mt-3 ml-6 rounded-card bg-surface-raised p-5 shadow-soft ring-1 ring-line"
      >
        <div className="flex items-center gap-2 text-xs font-medium text-accent">
          <Sparkles className="size-4" />
          Your guide is ready
        </div>
        <p className="mt-2 font-display text-xl font-semibold">A layover in Lisbon</p>
        <ol className="mt-4 space-y-3 text-sm">
          {stops.map((stop) => (
            <li key={stop} className="flex items-center gap-3">
              <MapPin className="size-4 shrink-0 text-ink-muted" />
              {stop}
            </li>
          ))}
        </ol>
      </motion.div>
    </div>
  );
}
