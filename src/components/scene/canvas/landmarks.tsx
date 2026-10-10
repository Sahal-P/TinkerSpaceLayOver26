"use client";

import { RoundedBox } from "@react-three/drei";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";

import { gable, unitBox, type RouteModel } from "@/components/scene/canvas/geometry";
import { useMaterials } from "@/components/scene/canvas/materials";
import { SCENE_STOP_IDS, type SceneStopId } from "@/components/scene/stops";

const archGeometry = createArch();

function createArch() {
  const shape = new THREE.Shape();
  shape.moveTo(-0.32, 0);
  shape.lineTo(-0.15, 0);
  shape.lineTo(-0.15, 0.2);
  shape.absarc(0, 0.2, 0.15, Math.PI, 0, true);
  shape.lineTo(0.15, 0);
  shape.lineTo(0.32, 0);
  shape.lineTo(0.32, 0.44);
  shape.lineTo(-0.32, 0.44);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.14,
    bevelEnabled: true,
    bevelThickness: 0.012,
    bevelSize: 0.012,
    bevelSegments: 2,
    curveSegments: 20,
  });
  geometry.translate(0, 0, -0.07);
  return geometry;
}

function Tram() {
  const m = useMaterials();
  return (
    <group>
      {[-0.055, 0.055].map((x) => (
        <mesh key={x} position={[x, 0.004, 0]} scale={[0.012, 0.01, 0.82]} geometry={unitBox} material={m.ink} />
      ))}
      <group position-y={0.02}>
        <RoundedBox args={[0.19, 0.06, 0.46]} radius={0.02} smoothness={2} position-y={0.03} material={m.plaster} castShadow />
        <RoundedBox args={[0.188, 0.13, 0.455]} radius={0.03} smoothness={3} position-y={0.12} material={m.flame} castShadow />
        <mesh position-y={0.11} scale={[0.192, 0.05, 0.36]} geometry={unitBox} material={m.window} />
        <mesh position={[0, 0.11, 0.226]} scale={[0.12, 0.05, 0.006]} geometry={unitBox} material={m.window} />
        <RoundedBox args={[0.17, 0.02, 0.4]} radius={0.008} smoothness={2} position-y={0.195} material={m.plaster} />
        <mesh position={[0, 0.27, -0.05]} rotation-x={-0.55} material={m.ink}>
          <cylinderGeometry args={[0.004, 0.004, 0.16, 4]} />
        </mesh>
      </group>
    </group>
  );
}

function Bakery() {
  const m = useMaterials();
  return (
    <group>
      <mesh scale={[0.34, 0.26, 0.28]} geometry={unitBox} material={m.plaster} castShadow receiveShadow />
      <mesh position={[0, 0.01, 0.141]} scale={[0.32, 0.24, 0.004]} geometry={unitBox} material={m.tile} />
      <mesh position-y={0.26} scale={[0.38, 0.14, 0.31]} geometry={gable} material={m.roof} castShadow />
      <mesh position={[0, 0.16, 0.18]} rotation-x={0.5} material={m.accent} castShadow>
        <boxGeometry args={[0.27, 0.008, 0.09]} />
      </mesh>
      <mesh position={[-0.07, 0, 0.145]} scale={[0.07, 0.13, 0.004]} geometry={unitBox} material={m.ink} />
      <mesh position={[0.07, 0.04, 0.145]} scale={[0.09, 0.07, 0.004]} geometry={unitBox} material={m.window} />
    </group>
  );
}

function Archway() {
  const m = useMaterials();
  return (
    <group>
      <mesh geometry={archGeometry} material={m.stone} castShadow receiveShadow />
      <mesh position-y={0.445} scale={[0.72, 0.035, 0.18]} geometry={unitBox} material={m.stoneDeep} castShadow />
      {[-0.43, 0.43].map((x) => (
        <mesh key={x} position={[x, 0, 0]} scale={[0.2, 0.2, 0.1]} geometry={unitBox} material={m.stone} castShadow receiveShadow />
      ))}
    </group>
  );
}

function Church() {
  const m = useMaterials();
  return (
    <group>
      <mesh scale={[0.3, 0.24, 0.42]} geometry={unitBox} material={m.plaster} castShadow receiveShadow />
      <mesh position-y={0.24} rotation-y={Math.PI / 2} scale={[0.46, 0.14, 0.33]} geometry={gable} material={m.roof} castShadow />
      <mesh position={[0, 0, 0.212]} scale={[0.08, 0.13, 0.006]} geometry={unitBox} material={m.ink} />
      <mesh position={[0, 0.19, 0.213]} rotation-x={Math.PI / 2} material={m.tile}>
        <cylinderGeometry args={[0.03, 0.03, 0.006, 16]} />
      </mesh>
      <group position={[-0.2, 0, 0.12]}>
        <mesh scale={[0.13, 0.52, 0.13]} geometry={unitBox} material={m.plasterWarm} castShadow receiveShadow />
        <mesh position={[0, 0.38, 0.066]} scale={[0.06, 0.08, 0.004]} geometry={unitBox} material={m.window} />
        <mesh position={[0.066, 0.38, 0]} rotation-y={Math.PI / 2} scale={[0.06, 0.08, 0.004]} geometry={unitBox} material={m.window} />
        <mesh position-y={0.6} rotation-y={Math.PI / 4} material={m.roof} castShadow>
          <coneGeometry args={[0.105, 0.16, 4]} />
        </mesh>
        <mesh position-y={0.7} scale={[0.008, 0.07, 0.008]} geometry={unitBox} material={m.ink} />
        <mesh position-y={0.745} scale={[0.036, 0.008, 0.008]} geometry={unitBox} material={m.ink} />
      </group>
    </group>
  );
}

const merlons = [-0.36, -0.24, -0.12, 0, 0.12, 0.24, 0.36];
const towerMerlons: Array<[number, number]> = [
  [-0.07, -0.07],
  [0.07, -0.07],
  [-0.07, 0.07],
  [0.07, 0.07],
];

function Castle() {
  const m = useMaterials();
  return (
    <group>
      <mesh position-z={-0.04} scale={[0.95, 0.3, 0.12]} geometry={unitBox} material={m.stone} castShadow receiveShadow />
      {merlons.map((x) => (
        <mesh key={x} position={[x, 0.3, -0.04]} scale={[0.07, 0.06, 0.12]} geometry={unitBox} material={m.stone} castShadow />
      ))}
      {[-0.52, 0.52].map((x) => (
        <group key={x} position={[x, 0, -0.04]}>
          <mesh scale={[0.2, 0.46, 0.2]} geometry={unitBox} material={m.stoneDeep} castShadow receiveShadow />
          {towerMerlons.map(([mx, mz]) => (
            <mesh key={`${mx}${mz}`} position={[mx, 0.46, mz]} scale={0.05} geometry={unitBox} material={m.stoneDeep} castShadow />
          ))}
        </group>
      ))}
      {Array.from({ length: 6 }, (_, step) => (
        <mesh
          key={step}
          position={[-0.3 + step * 0.1, 0, 0.12]}
          scale={[0.1, 0.03 + step * 0.03, 0.14]}
          geometry={unitBox}
          material={m.plasterWarm}
          castShadow
          receiveShadow
        />
      ))}
    </group>
  );
}

function Miradouro() {
  const m = useMaterials();
  return (
    <group>
      <mesh position-y={0.015} material={m.stone} receiveShadow>
        <cylinderGeometry args={[0.32, 0.34, 0.03, 32]} />
      </mesh>
      <mesh position-y={0.11} material={m.navy} castShadow>
        <cylinderGeometry args={[0.085, 0.095, 0.16, 8]} />
      </mesh>
      <mesh position-y={0.12} material={m.window}>
        <cylinderGeometry args={[0.088, 0.09, 0.05, 8]} />
      </mesh>
      <mesh position-y={0.24} material={m.ink} castShadow>
        <coneGeometry args={[0.14, 0.1, 8]} />
      </mesh>
      <mesh position-y={0.3} material={m.highlight}>
        <sphereGeometry args={[0.015, 12, 8]} />
      </mesh>
      <mesh position-y={0.07} rotation-x={-Math.PI / 2} material={m.ink}>
        <torusGeometry args={[0.3, 0.006, 4, 48, Math.PI]} />
      </mesh>
      <mesh position={[0.17, 0.03, -0.12]} scale={[0.12, 0.02, 0.04]} geometry={unitBox} material={m.trunk} castShadow />
    </group>
  );
}

const MODELS: Record<SceneStopId, () => ReactNode> = {
  tram: Tram,
  bakery: Bakery,
  archway: Archway,
  church: Church,
  castle: Castle,
  miradouro: Miradouro,
};

type LandmarkSlotProps = {
  frame: { position: THREE.Vector3; yaw: number };
  active: boolean;
  interactive: boolean;
  onSelect: () => void;
  children: ReactNode;
};

function LandmarkSlot({ frame, active, interactive, onSelect, children }: LandmarkSlotProps) {
  const ref = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  useFrame((_, delta) => {
    const group = ref.current;
    if (!group) return;
    const target = active ? 1.1 : hovered ? 1.05 : 1;
    group.scale.setScalar(THREE.MathUtils.damp(group.scale.x, target, 8, delta));
  });

  useEffect(
    () => () => {
      document.body.style.cursor = "";
    },
    [],
  );

  const events = interactive
    ? {
        onClick: (event: ThreeEvent<MouseEvent>) => {
          event.stopPropagation();
          onSelect();
        },
        onPointerOver: (event: ThreeEvent<PointerEvent>) => {
          event.stopPropagation();
          setHovered(true);
          document.body.style.cursor = "pointer";
        },
        onPointerOut: () => {
          setHovered(false);
          document.body.style.cursor = "";
        },
      }
    : {};

  return (
    <group ref={ref} position={frame.position} rotation-y={frame.yaw} {...events}>
      {children}
    </group>
  );
}

type LandmarksProps = {
  route: RouteModel;
  highlight: SceneStopId | null;
  onSelect?: (id: SceneStopId) => void;
};

export function Landmarks({ route, highlight, onSelect }: LandmarksProps) {
  return SCENE_STOP_IDS.map((id) => {
    const frame = route.frames[id];
    const Model = MODELS[id];
    const yaw = id === "tram" || id === "archway" ? frame.along : frame.facing;
    return (
      <LandmarkSlot
        key={id}
        frame={{ position: frame.position, yaw }}
        active={highlight === id}
        interactive={Boolean(onSelect)}
        onSelect={() => onSelect?.(id)}
      >
        <Model />
      </LandmarkSlot>
    );
  });
}
