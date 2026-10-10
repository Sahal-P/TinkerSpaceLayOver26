"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { createRibbon, type RouteModel } from "@/components/scene/canvas/geometry";
import { useMaterials } from "@/components/scene/canvas/materials";

const SAMPLES = 360;

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** The ivory footpath the route follows. */
export function RoutePath({ route }: { route: RouteModel }) {
  const m = useMaterials();
  const geometry = useMemo(() => createRibbon(route.curve, SAMPLES, 0.13, 0.022), [route]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh geometry={geometry} material={m.path} receiveShadow />;
}

type RouteProgressProps = {
  route: RouteModel;
  /** Theme highlight, for the traveler's halo. */
  color: string;
  mode: "hero" | "guide";
  /** Guide: route parameter of the active step. */
  target: number;
  reducedMotion: boolean;
};

/**
 * The highlighted route line and the traveler dot. In the hero the line draws itself, then the
 * traveler walks it on a loop; in the guide both ease to the active step.
 */
export function RouteProgress({ route, color, mode, target, reducedMotion }: RouteProgressProps) {
  const m = useMaterials();
  const geometry = useMemo(() => createRibbon(route.curve, SAMPLES, 0.045, 0.03), [route]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  const line = useRef<THREE.Mesh>(null);
  const traveler = useRef<THREE.Group>(null);
  const halo = useRef<THREE.Mesh>(null);
  const progress = useRef(0);
  const startedAt = useRef<number | null>(null);
  const scratch = useRef(new THREE.Vector3());

  useFrame((state, delta) => {
    const mesh = line.current;
    const dot = traveler.current;
    if (!mesh || !dot) return;
    const time = state.clock.elapsedTime;
    startedAt.current ??= time;
    const elapsed = time - startedAt.current;

    let drawn: number;
    let walker: number;
    let visibility = 1;
    if (mode === "hero") {
      drawn = reducedMotion ? 1 : easeInOut(clamp01((elapsed - 0.8) / 3.6));
      const loop = (elapsed - 4.6) / 18;
      walker = reducedMotion || loop < 0 ? 0 : loop % 1;
      visibility = reducedMotion || loop < 0 ? 0 : Math.min(walker / 0.04, (1 - walker) / 0.04, 1);
    } else {
      const goal = route.arcAt(target);
      progress.current = reducedMotion ? goal : THREE.MathUtils.damp(progress.current, goal, 3, delta);
      drawn = progress.current;
      walker = progress.current;
    }

    mesh.geometry.setDrawRange(0, Math.floor(drawn * SAMPLES) * 6);
    const point = route.curve.getPointAt(clamp01(walker), scratch.current);
    dot.position.set(point.x, point.y + 0.05, point.z);
    dot.scale.setScalar(Math.max(0.001, visibility));
    if (halo.current) {
      const pulse = reducedMotion ? 0.4 : (time * 0.9) % 1;
      halo.current.scale.setScalar(1 + pulse * 1.4);
      const material = halo.current.material;
      if (material instanceof THREE.MeshBasicMaterial) material.opacity = 0.5 * (1 - pulse);
    }
  });

  return (
    <group>
      <mesh ref={line} geometry={geometry} material={m.route} />
      <group ref={traveler}>
        <mesh material={m.highlight} castShadow>
          <sphereGeometry args={[0.045, 20, 14]} />
        </mesh>
        <mesh ref={halo} position-y={-0.04} rotation-x={-Math.PI / 2}>
          <ringGeometry args={[0.07, 0.095, 40]} />
          <meshBasicMaterial color={color} transparent opacity={0.5} depthWrite={false} toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}

const pinGeometry = new THREE.LatheGeometry(
  [
    [0, 0],
    [0.02, 0.05],
    [0.045, 0.1],
    [0.065, 0.15],
    [0.072, 0.19],
    [0.065, 0.235],
    [0.042, 0.265],
    [0, 0.28],
  ].map(([x = 0, y = 0]) => new THREE.Vector2(x, y)),
  32,
);

/** Floating pin over the destination, with a slow ripple on the ground. */
export function DestinationMarker({ route, color, reducedMotion }: { route: RouteModel; color: string; reducedMotion: boolean }) {
  const m = useMaterials();
  const end = useMemo(() => route.curve.getPoint(1), [route]);
  const pin = useRef<THREE.Group>(null);
  const ripple = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const time = state.clock.elapsedTime;
    if (pin.current) {
      pin.current.position.y = end.y + 0.55 + (reducedMotion ? 0 : Math.sin(time * 1.6) * 0.05);
      pin.current.rotation.y = reducedMotion ? 0 : time * 0.6;
    }
    if (ripple.current) {
      const phase = reducedMotion ? 0.5 : (time * 0.5) % 1;
      ripple.current.scale.setScalar(1 + phase * 2.2);
      const material = ripple.current.material;
      if (material instanceof THREE.MeshBasicMaterial) material.opacity = 0.55 * (1 - phase);
    }
  });

  return (
    <group>
      <group ref={pin} position={[end.x, end.y + 0.62, end.z]} scale={1.5}>
        <mesh geometry={pinGeometry} material={m.highlight} castShadow />
        <mesh position-y={0.19} rotation-x={Math.PI / 2} material={m.plaster}>
          <cylinderGeometry args={[0.032, 0.032, 0.16, 20]} />
        </mesh>
      </group>
      <mesh ref={ripple} position={[end.x, end.y + 0.04, end.z]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.1, 0.125, 48]} />
        <meshBasicMaterial color={color} transparent opacity={0.5} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}

/** Pulsing ring on the ground at the active guide step. */
export function FocusRing({ position, color, reducedMotion }: { position: THREE.Vector3; color: string; reducedMotion: boolean }) {
  const ring = useRef<THREE.Mesh>(null);

  useFrame((state, delta) => {
    const mesh = ring.current;
    if (!mesh) return;
    const y = position.y - 0.08;
    if (reducedMotion) mesh.position.set(position.x, y, position.z);
    else {
      mesh.position.x = THREE.MathUtils.damp(mesh.position.x, position.x, 5, delta);
      mesh.position.y = THREE.MathUtils.damp(mesh.position.y, y, 5, delta);
      mesh.position.z = THREE.MathUtils.damp(mesh.position.z, position.z, 5, delta);
    }
    const phase = reducedMotion ? 0.35 : (state.clock.elapsedTime * 0.8) % 1;
    mesh.scale.setScalar(1 + phase * 1.8);
    const material = mesh.material;
    if (material instanceof THREE.MeshBasicMaterial) material.opacity = 0.6 * (1 - phase);
  });

  return (
    <mesh ref={ring} position={[position.x, position.y - 0.08, position.z]} rotation-x={-Math.PI / 2}>
      <ringGeometry args={[0.16, 0.19, 56]} />
      <meshBasicMaterial color={color} transparent opacity={0.6} depthWrite={false} toneMapped={false} />
    </mesh>
  );
}
