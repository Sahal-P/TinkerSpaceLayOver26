"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";

import { enterTransition } from "@/lib/motion";

/**
 * Fades content up once it scrolls into view. With reduced motion, MotionProvider
 * drops the movement and keeps a gentle fade.
 */
export function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -12% 0px" }}
      transition={{ ...enterTransition, delay }}
    >
      {children}
    </motion.div>
  );
}
