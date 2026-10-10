export type SceneQuality = {
  maxDpr: number;
  shadowMapSize: number;
  terrain: { rings: number; segments: number };
  houses: number;
  trees: number;
};

/** Two tiers: phones and small or low-core devices get lighter geometry, shadows and DPR. */
export function detectQuality(): SceneQuality {
  const coarse = typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
  const constrained = coarse || window.innerWidth < 768 || (navigator.hardwareConcurrency || 8) <= 4;
  const dpr = window.devicePixelRatio || 1;

  return constrained
    ? { maxDpr: Math.min(dpr, 1.5), shadowMapSize: 1024, terrain: { rings: 36, segments: 104 }, houses: 30, trees: 36 }
    : { maxDpr: Math.min(dpr, 2), shadowMapSize: 2048, terrain: { rings: 56, segments: 156 }, houses: 52, trees: 64 };
}
