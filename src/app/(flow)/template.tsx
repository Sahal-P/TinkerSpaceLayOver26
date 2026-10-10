"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";

import { duration, ease } from "@/lib/motion";

/** Templates remount on navigation, so every flow screen gets the same soft entrance. */
export default function FlowTemplate({ children }: { children: ReactNode }) {
  return (
    <motion.div
      className="flex flex-1 flex-col"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: duration.slow, ease: ease.outSoft }}
    >
      {children}
    </motion.div>
  );
}
