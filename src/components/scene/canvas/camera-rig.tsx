"use client";

import { useFrame, useThree } from "@react-three/fiber";
import type { MotionValue } from "motion/react";
import { useEffect, useRef } from "react";
import * as THREE from "three";

const HERO = { azimuth: 0.72, elevation: 0.52, distance: 20, target: new THREE.Vector3(0.1, 0.55, -0.35) };
const GUIDE = { elevation: 0.8, distance: 7.4 };

type CameraRigProps = {
  mode: "hero" | "guide";
  focus: THREE.Vector3;
  scrollProgress?: MotionValue<number>;
  reducedMotion: boolean;
  exposure: number;
  /** Fog near/far as multiples of the camera distance. */
  fogRange: [number, number];
};

/**
 * Cinematic camera: slow drift, pointer parallax, scroll dolly in the hero, and smooth
 * flights between steps in the guide. Reduced motion holds a still frame.
 */
export function CameraRig({ mode, focus, scrollProgress, reducedMotion, exposure, fogRange }: CameraRigProps) {
  const invalidate = useThree((state) => state.invalidate);
  const pointer = useRef({ x: 0, y: 0 });
  const eased = useRef({ x: 0, y: 0 });
  const lookAt = useRef(HERO.target.clone());
  // Scratch vectors live in refs: mutated every frame, never during render.
  const scratch = useRef({ target: new THREE.Vector3(), position: new THREE.Vector3() });

  useEffect(() => {
    if (reducedMotion) return;
    const onMove = (event: PointerEvent) => {
      pointer.current.x = (event.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = (event.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [reducedMotion]);

  // With an on-demand frameloop, render a frame whenever the shot changes.
  useEffect(() => invalidate(), [focus, mode, invalidate]);

  useFrame((state, delta) => {
    const { camera, size, clock, gl } = state;
    const { target: desiredTarget, position: desiredPosition } = scratch.current;
    gl.toneMappingExposure = exposure;
    const dt = Math.min(delta, 0.1);
    const aspect = size.width / Math.max(1, size.height);
    // Pull back on narrow frames so the island still fits; the hero lets the shore crop a little.
    const fit = mode === "hero" ? THREE.MathUtils.clamp(1 / aspect, 0.9, 1.7) : THREE.MathUtils.clamp(1.08 / aspect, 1, 1.9);

    const follow = reducedMotion ? 1 : 1 - Math.exp(-3 * dt);
    eased.current.x += ((reducedMotion ? 0 : pointer.current.x) - eased.current.x) * follow;
    eased.current.y += ((reducedMotion ? 0 : pointer.current.y) - eased.current.y) * follow;

    let azimuth: number;
    let elevation: number;
    let distance: number;
    if (mode === "hero") {
      const scroll = scrollProgress?.get() ?? 0;
      const drift = reducedMotion ? 0 : Math.sin(clock.elapsedTime * 0.05) * 0.1;
      azimuth = HERO.azimuth + drift + eased.current.x * 0.1;
      elevation = HERO.elevation + scroll * 0.22 - eased.current.y * 0.04;
      distance = HERO.distance * fit * (1 - scroll * 0.2);
      desiredTarget.copy(HERO.target);
    } else {
      azimuth = HERO.azimuth + eased.current.x * 0.06;
      elevation = GUIDE.elevation - eased.current.y * 0.03;
      distance = GUIDE.distance * fit;
      desiredTarget.copy(focus);
    }

    desiredPosition.set(
      desiredTarget.x + Math.cos(elevation) * Math.sin(azimuth) * distance,
      desiredTarget.y + Math.sin(elevation) * distance,
      desiredTarget.z + Math.cos(elevation) * Math.cos(azimuth) * distance,
    );

    // Atmospheric depth follows the camera, so wider shots don't wash out.
    if (state.scene.fog instanceof THREE.Fog) {
      state.scene.fog.near = distance * fogRange[0];
      state.scene.fog.far = distance * fogRange[1];
    }

    const k = reducedMotion ? 1 : 1 - Math.exp(-2 * dt);
    camera.position.lerp(desiredPosition, k);
    lookAt.current.lerp(desiredTarget, k);
    camera.lookAt(lookAt.current);
  });

  return null;
}
