import { createContext, useContext } from "react";
import * as THREE from "three";

import { sceneColors, type SceneTheme } from "@/components/scene/palette";

/** One shared set of materials per theme keeps shader programs and draw state to a minimum. */
export function createMaterials(theme: SceneTheme) {
  const standard = (color: THREE.ColorRepresentation, parameters: THREE.MeshStandardMaterialParameters = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, ...parameters });
  const glowing = (color: THREE.ColorRepresentation, base: number) =>
    standard(color, { emissive: sceneColors.windowGlow, emissiveIntensity: base + theme.glow, roughness: 0.4 });

  return {
    terrain: standard(sceneColors.materialBase, { vertexColors: true, flatShading: true, roughness: 0.95 }),
    // Unlit and untoned: an exact color near the island that fogs into the CSS haze behind the canvas.
    water: new THREE.MeshBasicMaterial({ color: theme.water, toneMapped: false }),
    path: standard(sceneColors.path, {
      roughness: 1,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    }),
    route: new THREE.MeshBasicMaterial({
      color: theme.highlight,
      side: THREE.DoubleSide,
      toneMapped: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
    }),
    highlight: standard(theme.highlight, { roughness: 0.4, emissive: theme.highlight, emissiveIntensity: theme.highlightGlow }),
    accent: standard(sceneColors.accent, { roughness: 0.55 }),
    flame: standard(sceneColors.flame, { roughness: 0.42 }),
    navy: standard(sceneColors.navy, { roughness: 0.6 }),
    plaster: standard(sceneColors.plaster[0]),
    plasterWarm: standard(sceneColors.plaster[1]),
    roof: standard(sceneColors.roof[0], { roughness: 0.7 }),
    stone: standard(sceneColors.stone, { roughness: 0.95 }),
    stoneDeep: standard(sceneColors.stoneDeep, { roughness: 0.95 }),
    ink: standard(sceneColors.ink, { roughness: 0.55 }),
    tile: standard(sceneColors.tile, { roughness: 0.3, metalness: 0.05 }),
    window: glowing(sceneColors.window, 0),
    lantern: glowing(sceneColors.lantern, 0.8),
    trunk: standard(sceneColors.trunk),
    cloud: standard(sceneColors.cloud, { roughness: 1, flatShading: true, emissive: sceneColors.cloud, emissiveIntensity: theme.cloudGlow }),
    sail: standard(sceneColors.sail, { side: THREE.DoubleSide }),
    // White base colors, tinted per instance.
    tinted: standard(sceneColors.materialBase),
    tintedRoof: standard(sceneColors.materialBase, { roughness: 0.7 }),
    tintedFoliage: standard(sceneColors.materialBase, { flatShading: true, roughness: 0.9 }),
  };
}

export type SceneMaterials = ReturnType<typeof createMaterials>;

export const MaterialsContext = createContext<SceneMaterials | null>(null);

export function useMaterials(): SceneMaterials {
  const materials = useContext(MaterialsContext);
  if (!materials) throw new Error("useMaterials must be used inside the diorama.");
  return materials;
}
