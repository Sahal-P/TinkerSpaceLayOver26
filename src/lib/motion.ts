import type { Transition } from "motion/react";

/** Mirrors `--ease-out-soft` in src/styles/tokens.css. */
export const easeOutSoft = [0.22, 1, 0.36, 1] as const;

export const enterTransition: Transition = { duration: 0.6, ease: easeOutSoft };
