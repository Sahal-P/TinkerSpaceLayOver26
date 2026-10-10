"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import {
  cypressCone,
  scatterHouses,
  scatterTrees,
  treeCrown,
  treeTrunk,
  unitBox,
  gable,
  type RouteModel,
} from "@/components/scene/canvas/geometry";
import { useMaterials } from "@/components/scene/canvas/materials";

/** The village and its trees, drawn as six instanced meshes. */
export function Scatter({ route, houses: houseCount, trees: treeCount }: { route: RouteModel; houses: number; trees: number }) {
  const m = useMaterials();
  const houses = useMemo(() => scatterHouses(route, houseCount), [route, houseCount]);
  const trees = useMemo(() => scatterTrees(route, houses, treeCount), [route, houses, treeCount]);
  const cypresses = useMemo(() => trees.filter((tree) => tree.kind === "cypress"), [trees]);
  const rounds = useMemo(() => trees.filter((tree) => tree.kind === "round"), [trees]);

  const walls = useRef<THREE.InstancedMesh>(null);
  const roofs = useRef<THREE.InstancedMesh>(null);
  const windows = useRef<THREE.InstancedMesh>(null);
  const cypressMesh = useRef<THREE.InstancedMesh>(null);
  const crowns = useRef<THREE.InstancedMesh>(null);
  const trunks = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    const meshes = [walls.current, roofs.current, windows.current, cypressMesh.current, crowns.current, trunks.current];
    if (meshes.some((mesh) => !mesh)) return;

    houses.forEach((house, index) => {
      dummy.rotation.set(0, house.yaw, 0);
      dummy.position.set(house.x, house.y, house.z);
      dummy.scale.set(house.width, house.height, house.depth);
      dummy.updateMatrix();
      walls.current?.setMatrixAt(index, dummy.matrix);
      walls.current?.setColorAt(index, color.set(house.plaster));

      dummy.position.set(house.x, house.y + house.height, house.z);
      dummy.scale.set(house.width * 1.14, house.height * 0.62, house.depth * 1.14);
      dummy.updateMatrix();
      roofs.current?.setMatrixAt(index, dummy.matrix);
      roofs.current?.setColorAt(index, color.set(house.roof));

      const front = house.depth / 2 + 0.002;
      dummy.position.set(
        house.x + Math.sin(house.yaw) * front,
        house.y + house.height * 0.42,
        house.z + Math.cos(house.yaw) * front,
      );
      dummy.scale.set(house.width * 0.36, house.height * 0.34, 0.006);
      dummy.updateMatrix();
      windows.current?.setMatrixAt(index, dummy.matrix);
    });

    const placeTrees = (mesh: THREE.InstancedMesh | null, list: typeof trees, tint: boolean) => {
      list.forEach((tree, index) => {
        dummy.rotation.set(0, index * 1.7, 0);
        dummy.position.set(tree.x, tree.y, tree.z);
        dummy.scale.setScalar(tree.scale);
        dummy.updateMatrix();
        mesh?.setMatrixAt(index, dummy.matrix);
        if (tint) mesh?.setColorAt(index, color.set(tree.color));
      });
    };
    placeTrees(cypressMesh.current, cypresses, true);
    placeTrees(crowns.current, rounds, true);
    placeTrees(trunks.current, rounds, false);

    for (const mesh of meshes) {
      if (!mesh) continue;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  }, [houses, cypresses, rounds, m]);

  return (
    <group>
      <instancedMesh ref={walls} args={[unitBox, m.tinted, houses.length]} castShadow receiveShadow />
      <instancedMesh ref={roofs} args={[gable, m.tintedRoof, houses.length]} castShadow />
      <instancedMesh ref={windows} args={[unitBox, m.window, houses.length]} />
      <instancedMesh ref={cypressMesh} args={[cypressCone, m.tintedFoliage, cypresses.length]} castShadow />
      <instancedMesh ref={crowns} args={[treeCrown, m.tintedFoliage, rounds.length]} castShadow />
      <instancedMesh ref={trunks} args={[treeTrunk, m.trunk, rounds.length]} />
    </group>
  );
}
