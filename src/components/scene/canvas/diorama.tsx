"use client";

import type { MotionValue } from "motion/react";
import { useEffect, useMemo } from "react";
import * as THREE from "three";

import { CameraRig } from "@/components/scene/canvas/camera-rig";
import { Boat, Clouds, Lighthouse, Shallows, Water } from "@/components/scene/canvas/details";
import { createRouteModel, createTerrainGeometry } from "@/components/scene/canvas/geometry";
import { Landmarks } from "@/components/scene/canvas/landmarks";
import { MaterialsContext, createMaterials } from "@/components/scene/canvas/materials";
import type { SceneQuality } from "@/components/scene/canvas/quality";
import { DestinationMarker, FocusRing, RoutePath, RouteProgress } from "@/components/scene/canvas/route";
import { Scatter } from "@/components/scene/canvas/scatter";
import { resolveStopFractions } from "@/components/scene/layout";
import type { SceneTheme } from "@/components/scene/palette";
import type { SceneStopId } from "@/components/scene/stops";

export type DioramaProps = {
  mode: "hero" | "guide";
  stops: ReadonlyArray<SceneStopId | null>;
  activeIndex: number;
  onSelectStop?: (index: number) => void;
  scrollProgress?: MotionValue<number>;
  reducedMotion: boolean;
  theme: SceneTheme;
  quality: SceneQuality;
};

/** The miniature world: an island with its village, landmarks and route, in an open sea. */
export function Diorama({ mode, stops, activeIndex, onSelectStop, scrollProgress, reducedMotion, theme, quality }: DioramaProps) {
  const materials = useMemo(() => createMaterials(theme), [theme]);
  useEffect(() => () => Object.values(materials).forEach((material) => material.dispose()), [materials]);

  const terrain = useMemo(() => createTerrainGeometry(quality.terrain.rings, quality.terrain.segments), [quality]);
  useEffect(() => () => terrain.dispose(), [terrain]);

  const route = useMemo(() => createRouteModel(), []);
  const fractions = useMemo(() => resolveStopFractions(stops), [stops]);
  const activeFraction = fractions[activeIndex] ?? 0;
  const nextFraction = fractions[activeIndex + 1] ?? activeFraction;
  // The ring marks the active step; the camera looks a little ahead, toward where you're walking.
  const ring = useMemo(() => {
    const point = route.curve.getPoint(activeFraction);
    return new THREE.Vector3(point.x, point.y + 0.12, point.z);
  }, [route, activeFraction]);
  const focus = useMemo(() => {
    const point = route.curve.getPoint(activeFraction + (nextFraction - activeFraction) * 0.2);
    return new THREE.Vector3(point.x, point.y + 0.12, point.z);
  }, [route, activeFraction, nextFraction]);

  const guide = mode === "guide";
  const selectStop = guide && onSelectStop
    ? (id: SceneStopId) => {
        const index = stops.indexOf(id);
        if (index >= 0) onSelectStop(index);
      }
    : undefined;

  return (
    <MaterialsContext value={materials}>
      <mesh geometry={terrain} material={materials.terrain} castShadow receiveShadow />
      <Water />
      <Shallows color={theme.shallows} />
      <RoutePath route={route} />
      <RouteProgress route={route} color={theme.highlight} mode={mode} target={activeFraction} reducedMotion={reducedMotion} />
      <Landmarks route={route} highlight={guide ? (stops[activeIndex] ?? null) : null} onSelect={selectStop} />
      <Scatter route={route} houses={quality.houses} trees={quality.trees} />
      <Lighthouse theme={theme} reducedMotion={reducedMotion} />
      <Boat reducedMotion={reducedMotion} />
      <Clouds reducedMotion={reducedMotion} />
      <DestinationMarker route={route} color={theme.highlight} reducedMotion={reducedMotion} />
      {guide ? <FocusRing position={ring} color={theme.highlight} reducedMotion={reducedMotion} /> : null}
      <CameraRig
        mode={mode}
        focus={focus}
        scrollProgress={scrollProgress}
        reducedMotion={reducedMotion}
        exposure={theme.exposure}
        fogRange={theme.fog}
      />
    </MaterialsContext>
  );
}
