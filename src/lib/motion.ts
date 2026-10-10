import type { Transition, Variants } from "motion/react";

/**
 * The shared animation system. Motion handles interaction and state changes;
 * first-paint entrances use the CSS `animate-rise` token so text never waits for JavaScript.
 */

/** Mirrors --ease-out-soft and --ease-cinematic in src/styles/tokens.css. */
export const ease = {
  outSoft: [0.22, 1, 0.36, 1],
  cinematic: [0.65, 0, 0.35, 1],
} as const;

export const duration = {
  fast: 0.18,
  base: 0.35,
  slow: 0.7,
  cinematic: 1.1,
} as const;

export const spring = {
  soft: { type: "spring", stiffness: 160, damping: 24, mass: 0.9 },
  snappy: { type: "spring", stiffness: 420, damping: 32 },
} as const satisfies Record<string, Transition>;

export const enterTransition: Transition = { duration: duration.slow, ease: ease.outSoft };

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: enterTransition },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: duration.base, ease: ease.outSoft } },
};

export function stagger(staggerChildren = 0.06, delayChildren = 0): Variants {
  return { hidden: {}, visible: { transition: { staggerChildren, delayChildren } } };
}
