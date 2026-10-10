"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { unitBox } from "@/components/scene/canvas/geometry";
import { useMaterials } from "@/components/scene/canvas/materials";
import { BAY, DIORAMA_RADIUS, LIGHTHOUSE, WATER_LEVEL, terrainHeight } from "@/components/scene/layout";
import { sceneColors, type SceneTheme } from "@/components/scene/palette";

/** Far enough that the fog has fully hidden the edge from every camera position. */
const SEA_RADIUS = 160;

/** Open sea around the island, fading into the haze with distance. */
export function Water() {
  const m = useMaterials();
  return (
    <mesh position-y={WATER_LEVEL} rotation-x={-Math.PI / 2} material={m.water}>
      <circleGeometry args={[SEA_RADIUS, 72]} />
    </mesh>
  );
}

/** Paler water hugging the shore (under the land it is hidden), fading out to the open sea. */
export function Shallows({ color }: { color: string }) {
  const geometry = useMemo(() => {
    const inner = 1.8;
    const outer = DIORAMA_RADIUS + 1.2;
    const ring = new THREE.RingGeometry(inner, outer, 96, 2);
    const position = ring.getAttribute("position");
    const tint = new THREE.Color(color);
    const colors = new Float32Array(position.count * 4);
    const fadeFrom = (inner + outer) / 2;
    for (let index = 0; index < position.count; index++) {
      const radius = Math.hypot(position.getX(index), position.getY(index));
      const alpha = radius <= fadeFrom + 0.001 ? 0.85 : 0;
      colors.set([tint.r, tint.g, tint.b, alpha], index * 4);
    }
    ring.setAttribute("color", new THREE.BufferAttribute(colors, 4));
    return ring;
  }, [color]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh geometry={geometry} position-y={WATER_LEVEL + 0.004} rotation-x={-Math.PI / 2}>
      <meshBasicMaterial vertexColors transparent depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

const towerRadius = (height: number) => 0.08 - ((height - 0.05) / 0.5) * 0.025;

/** Striped lighthouse on the headland; its beam sweeps the bay at night. */
export function Lighthouse({ theme, reducedMotion }: { theme: SceneTheme; reducedMotion: boolean }) {
  const m = useMaterials();
  const beam = useRef<THREE.Group>(null);
  const y = terrainHeight(LIGHTHOUSE.x, LIGHTHOUSE.z);

  useFrame((state) => {
    if (beam.current && !reducedMotion) beam.current.rotation.y = state.clock.elapsedTime * 0.5;
  });

  return (
    <group position={[LIGHTHOUSE.x, y, LIGHTHOUSE.z]}>
      <mesh position-y={0.02} material={m.stoneDeep} castShadow receiveShadow>
        <cylinderGeometry args={[0.14, 0.18, 0.08, 10]} />
      </mesh>
      <mesh position-y={0.3} material={m.plaster} castShadow>
        <cylinderGeometry args={[0.055, 0.08, 0.5, 20]} />
      </mesh>
      {[0.2, 0.36].map((height) => (
        <mesh key={height} position-y={height} material={m.accent}>
          <cylinderGeometry args={[towerRadius(height + 0.025) + 0.003, towerRadius(height - 0.025) + 0.003, 0.05, 20]} />
        </mesh>
      ))}
      <mesh position-y={0.56} material={m.ink}>
        <cylinderGeometry args={[0.08, 0.08, 0.015, 16]} />
      </mesh>
      <mesh position-y={0.6} material={m.lantern}>
        <cylinderGeometry args={[0.045, 0.045, 0.07, 12]} />
      </mesh>
      <mesh position-y={0.635} material={m.accent}>
        <sphereGeometry args={[0.048, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      {theme.name === "night" ? (
        <group ref={beam} position-y={0.6}>
          <mesh position-x={1.1} rotation-z={Math.PI / 2}>
            <coneGeometry args={[0.32, 2.2, 24, 1, true]} />
            <meshBasicMaterial
              color={sceneColors.windowGlow}
              transparent
              opacity={0.07}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              side={THREE.DoubleSide}
              toneMapped={false}
            />
          </mesh>
        </group>
      ) : null}
    </group>
  );
}

/** A small sailboat drifting in the bay. */
export function Boat({ reducedMotion }: { reducedMotion: boolean }) {
  const m = useMaterials();
  const boat = useRef<THREE.Group>(null);
  const sail = useMemo(
    () => new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(0.14, 0), new THREE.Vector2(0, 0.21)])),
    [],
  );
  const home = { x: BAY.x + 0.25, z: BAY.z - 0.1 };

  useFrame((state) => {
    if (!boat.current || reducedMotion) return;
    const time = state.clock.elapsedTime;
    boat.current.position.set(home.x + Math.sin(time * 0.08) * 0.25, WATER_LEVEL + Math.sin(time * 1.3) * 0.008, home.z);
    boat.current.rotation.z = Math.sin(time * 1.1) * 0.05;
  });

  return (
    <group ref={boat} position={[home.x, WATER_LEVEL, home.z]} rotation-y={0.6}>
      <mesh scale={[0.2, 0.04, 0.07]} geometry={unitBox} material={m.plasterWarm} castShadow />
      <mesh position-y={0.036} scale={[0.19, 0.008, 0.072]} geometry={unitBox} material={m.accent} />
      <mesh position={[0.01, 0.15, 0]} material={m.trunk}>
        <cylinderGeometry args={[0.005, 0.005, 0.22, 5]} />
      </mesh>
      <mesh position={[0.015, 0.06, 0]} geometry={sail} material={m.sail} castShadow />
    </group>
  );
}

const clouds = [
  { x: -1.4, y: 3.2, z: -1.7, scale: 1 },
  { x: 2.3, y: 2.8, z: -0.3, scale: 0.72 },
];
const puffs: Array<[number, number, number, number]> = [
  [0, 0, 0, 0.32],
  [0.3, -0.05, 0.05, 0.24],
  [-0.32, -0.07, -0.02, 0.22],
  [0.08, 0.12, -0.05, 0.2],
];
const puffGeometry = new THREE.IcosahedronGeometry(1, 1);

/** Two slow low-poly clouds drifting over the ridge. */
export function Clouds({ reducedMotion }: { reducedMotion: boolean }) {
  const m = useMaterials();
  const groups = useRef<Array<THREE.Group | null>>([]);

  useFrame((state) => {
    if (reducedMotion) return;
    const time = state.clock.elapsedTime;
    groups.current.forEach((group, index) => {
      const cloud = clouds[index];
      if (group && cloud) group.position.x = cloud.x + Math.sin(time * 0.03 + index * 2) * 0.6;
    });
  });

  return clouds.map((cloud, index) => (
    <group
      key={index}
      ref={(group) => {
        groups.current[index] = group;
      }}
      position={[cloud.x, cloud.y, cloud.z]}
      scale={cloud.scale}
    >
      {puffs.map(([x, y, z, r], puff) => (
        <mesh key={puff} position={[x, y, z]} scale={[r * 1.3, r * 0.8, r]} geometry={puffGeometry} material={m.cloud} />
      ))}
    </group>
  ));
}
