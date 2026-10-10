"use client";

import { AnimatePresence, motion } from "motion/react";

import { spring } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { Direction } from "@/lib/wayfinding";

const rotation: Record<Direction, number> = {
  start: 0,
  straight: 0,
  slight_left: -45,
  left: -90,
  slight_right: 45,
  right: 90,
  u_turn: 180,
  arrive: 0,
  unknown: 0,
};

type Glyph = "arrow" | "stairs" | "start" | "arrive" | "unknown";

function glyphFor(direction: Direction): Glyph {
  if (direction === "start" || direction === "arrive") return direction;
  return direction === "unknown" ? "unknown" : "arrow";
}

const ticks = Array.from({ length: 24 }, (_, index) => index * 15);

/** Compass-style direction dial. The arrow springs to each new heading. */
export function DirectionIndicator({
  direction,
  incline = null,
  size = "lg",
  className,
}: {
  direction: Direction;
  incline?: "up" | "down" | null;
  size?: "sm" | "lg";
  className?: string;
}) {
  const glyph =
    direction === "straight" && incline ? "stairs" : glyphFor(direction);
  const large = size === "lg";

  return (
    <svg
      viewBox="0 0 120 120"
      aria-hidden
      className={cn(large ? "size-28 sm:size-32" : "size-10", className)}
    >
      <circle
        cx="60"
        cy="60"
        r="58.5"
        className="fill-surface-raised stroke-line-strong"
        strokeWidth={large ? 1 : 3}
      />
      {large
        ? ticks.map((angle) => (
            <line
              key={angle}
              x1="60"
              y1={angle % 90 === 0 ? 7 : 9}
              x2="60"
              y2="13"
              transform={`rotate(${angle} 60 60)`}
              className={
                angle === 0 ? "stroke-accent-ink" : "stroke-line-strong"
              }
              strokeWidth={angle % 90 === 0 ? 1.5 : 1}
            />
          ))
        : null}
      <motion.g
        initial={false}
        animate={{
          rotate:
            direction === "straight" && incline === "down"
              ? 180
              : rotation[direction],
        }}
        transition={spring.soft}
        style={{ transformOrigin: "60px 60px", transformBox: "view-box" }}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.g
            key={glyph}
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.7 }}
            transition={spring.snappy}
            style={{ transformOrigin: "60px 60px", transformBox: "view-box" }}
            className="fill-none stroke-accent-ink"
            strokeWidth={large ? 7 : 10}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {glyph === "unknown" ? (
              <text
                x="60"
                y="75"
                textAnchor="middle"
                className="fill-accent-ink stroke-none"
                fontSize="46"
              >
                ?
              </text>
            ) : null}
            {glyph === "arrow" ? (
              <path d="M60 88V34M40 53l20-20 20 20" />
            ) : null}
            {glyph === "stairs" ? (
              <path d="M40 66l20-20 20 20M40 88l20-20 20 20M40 44l20-20 20 20" />
            ) : null}
            {glyph === "start" ? (
              <>
                <circle cx="60" cy="60" r="22" strokeOpacity="0.35" />
                <circle cx="60" cy="60" r="8" className="fill-accent-ink" />
              </>
            ) : null}
            {glyph === "arrive" ? (
              <>
                <path
                  d="M60 92s-22-19-22-37a22 22 0 0 1 44 0c0 18-22 37-22 37Z"
                  className="fill-accent-ink"
                />
                <circle
                  cx="60"
                  cy="55"
                  r="7"
                  className="fill-surface-raised stroke-none"
                />
              </>
            ) : null}
          </motion.g>
        </AnimatePresence>
      </motion.g>
    </svg>
  );
}
