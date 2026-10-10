"use client";

import { useInView, useReducedMotion, type MotionValue } from "motion/react";
import dynamic from "next/dynamic";
import { useRef, useState } from "react";

import { RouteSketch } from "@/components/route-sketch";
import { DEFAULT_ANCHORS } from "@/components/scene/layout";
import type { SceneStopId } from "@/components/scene/stops";
import { useColorScheme, useWebGLSupport } from "@/components/scene/use-scene-environment";
import { cn } from "@/lib/utils";

// Three.js only loads when WebGL is available, in its own chunk.
const SceneCanvas = dynamic(() => import("@/components/scene/canvas/scene-canvas"), { ssr: false });

export type SceneMode = "hero" | "guide";

export type JourneySceneProps = {
  mode: SceneMode;
  /** Landmark anchor for each journey step; defaults to the full demo route. */
  stops?: ReadonlyArray<SceneStopId | null>;
  activeIndex?: number;
  onSelectStop?: (index: number) => void;
  /** Hero only: 0 at the top of the hero, 1 once it has scrolled away. */
  scrollProgress?: MotionValue<number>;
  label: string;
  /** Must position the element (`relative` or `absolute`) and give it a size. */
  className?: string;
  /** Extra classes for the 2D fallback, e.g. to match the 3D composition. */
  fallbackClassName?: string;
};

/**
 * The miniature journey. Shows the illustrated 2D fallback first (and permanently
 * without WebGL), then crossfades to the 3D scene once it has rendered.
 */
export function JourneyScene({
  mode,
  stops = DEFAULT_ANCHORS,
  activeIndex = 0,
  onSelectStop,
  scrollProgress,
  label,
  className,
  fallbackClassName,
}: JourneySceneProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "160px 0px" });
  const webgl = useWebGLSupport();
  const scheme = useColorScheme();
  const reducedMotion = useReducedMotion() ?? false;
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");

  const showCanvas = webgl === true && status !== "failed";
  const ready = showCanvas && status === "ready";

  return (
    <div ref={ref} role="img" aria-label={label} className={cn("isolate overflow-hidden bg-sea", className)}>
      <div className={cn("absolute inset-0 transition-opacity duration-700", ready ? "opacity-0" : "opacity-100")}>
        <RouteSketch
          variant="landscape"
          stops={stops}
          activeIndex={mode === "guide" ? activeIndex : undefined}
          onSelectStop={onSelectStop}
          className={cn("p-[6%]", fallbackClassName)}
        />
      </div>
      {showCanvas ? (
        <div
          className={cn(
            "absolute inset-0 transition-opacity duration-1000 ease-out-soft",
            ready ? "opacity-100" : "opacity-0",
            mode === "hero" && "pointer-events-none",
          )}
        >
          <SceneCanvas
            mode={mode}
            stops={stops}
            activeIndex={activeIndex}
            onSelectStop={onSelectStop}
            scrollProgress={scrollProgress}
            reducedMotion={reducedMotion}
            scheme={scheme}
            active={inView}
            onReady={() => setStatus("ready")}
            onLost={() => setStatus("failed")}
          />
        </div>
      ) : null}
    </div>
  );
}
