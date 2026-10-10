"use client";

import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";

/** App-wide Motion defaults: honor the OS "reduce motion" setting. */
export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
