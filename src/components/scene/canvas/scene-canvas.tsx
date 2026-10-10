"use client";

import { PerformanceMonitor } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import type { MotionValue } from "motion/react";
import { useState } from "react";

import { Diorama } from "@/components/scene/canvas/diorama";
import { detectQuality } from "@/components/scene/canvas/quality";
import { dayTheme, nightTheme, type SceneTheme } from "@/components/scene/palette";
import type { SceneStopId } from "@/components/scene/stops";

export type SceneCanvasProps = {
  mode: "hero" | "guide";
  stops: ReadonlyArray<SceneStopId | null>;
  activeIndex: number;
  onSelectStop?: (index: number) => void;
  scrollProgress?: MotionValue<number>;
  reducedMotion: boolean;
  scheme: "light" | "dark";
  /** False while offscreen: rendering pauses entirely. */
  active: boolean;
  onReady: () => void;
  onLost: () => void;
};

function Lights({ theme, shadowMapSize }: { theme: SceneTheme; shadowMapSize: number }) {
  return (
    <>
      <hemisphereLight args={[theme.hemisphere.sky, theme.hemisphere.ground, theme.hemisphere.intensity]} />
      <directionalLight
        position={theme.key.position}
        color={theme.key.color}
        intensity={theme.key.intensity}
        castShadow
        shadow-mapSize={[shadowMapSize, shadowMapSize]}
        shadow-camera-left={-5.5}
        shadow-camera-right={5.5}
        shadow-camera-top={5.5}
        shadow-camera-bottom={-5.5}
        shadow-camera-near={0.5}
        shadow-camera-far={30}
        shadow-bias={-0.0004}
        shadow-normalBias={0.025}
        shadow-radius={3}
      />
      <directionalLight position={[-6, 4, -5]} color={theme.fill.color} intensity={theme.fill.intensity} />
    </>
  );
}

export default function SceneCanvas({ scheme, active, reducedMotion, onReady, onLost, ...scene }: SceneCanvasProps) {
  const [quality] = useState(detectQuality);
  const [dpr, setDpr] = useState(quality.maxDpr);
  const theme = scheme === "dark" ? nightTheme : dayTheme;

  return (
    <Canvas
      // three r18x removed PCFSoftShadowMap; PCF plus a shadow radius keeps edges soft.
      shadows="percentage"
      dpr={dpr}
      frameloop={!active ? "never" : reducedMotion ? "demand" : "always"}
      camera={{ fov: 24, near: 0.5, far: 240, position: [13, 11, 16] }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance", stencil: false }}
      onCreated={({ gl }) => {
        gl.domElement.addEventListener(
          "webglcontextlost",
          (event) => {
            event.preventDefault();
            onLost();
          },
          { once: true },
        );
        requestAnimationFrame(() => onReady());
      }}
    >
      <fog attach="fog" args={[theme.background, 20, 45]} />
      <PerformanceMonitor
        onDecline={() => setDpr(1)}
        onIncline={() => setDpr(quality.maxDpr)}
        flipflops={3}
        onFallback={() => setDpr(1)}
      />
      <Lights theme={theme} shadowMapSize={quality.shadowMapSize} />
      <Diorama {...scene} reducedMotion={reducedMotion} theme={theme} quality={quality} />
    </Canvas>
  );
}
