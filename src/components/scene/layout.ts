import { SCENE_STOP_IDS, type SceneStopId } from "@/components/scene/stops";

/*
 * Art-directed layout of the miniature world, shared by the 3D scene and its 2D fallbacks.
 * Pure math with no Three.js import, so fallbacks stay out of the 3D bundle.
 * Units are scene units: the island's terrain is a disc of radius 4 in an open sea, y is up.
 */

export const DIORAMA_RADIUS = 4;
export const WATER_LEVEL = -0.14;
/** Sea floor at the edge of the terrain disc, safely below the water line. */
export const SEA_FLOOR = -0.5;

type Peak = readonly [x: number, z: number, height: number, radius: number];

/** Mountain ridge along the back of the disc. */
export const MOUNTAINS: readonly Peak[] = [
  [-2.3, -2.55, 1.9, 1.15],
  [-0.75, -2.95, 2.55, 1.1],
  [0.85, -2.85, 2.05, 1.0],
  [2.35, -2.25, 1.45, 0.95],
  [-3.05, -1.35, 1.0, 0.85],
];

/** The town hill: church, castle and miradouro sit on its slopes. */
export const TOWN_HILL: Peak = [0.9, -0.55, 0.95, 1.45];

const HILLS: readonly Peak[] = [TOWN_HILL, [-1.5, 0.5, 0.32, 1.1], [2.7, 1.2, 0.26, 0.9]];

export const BAY = { x: -2.35, z: 2.0, radius: 1.35, depth: 0.7 } as const;

/** Lighthouse headland on the far side of the bay. */
export const LIGHTHOUSE = { x: -3.25, z: 0.95 } as const;

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function peakSum(peaks: readonly Peak[], x: number, z: number): number {
  let height = 0;
  for (const [px, pz, ph, pr] of peaks) {
    height += ph * Math.exp(-((x - px) ** 2 + (z - pz) ** 2) / (pr * pr));
  }
  return height;
}

/** Where the land starts sinking into the sea. Varies with the angle, for an uneven shore. */
function shoreStart(x: number, z: number): number {
  const angle = Math.atan2(z, x);
  return DIORAMA_RADIUS - 0.5 + 0.1 * Math.sin(angle * 3 + 0.8) + 0.06 * Math.sin(angle * 7 + 2.1);
}

export function terrainHeight(x: number, z: number): number {
  const distance = Math.hypot(x, z);
  if (distance >= DIORAMA_RADIUS) return SEA_FLOOR;

  let height = peakSum(MOUNTAINS, x, z) + peakSum(HILLS, x, z);
  // Ridged detail on the mountains, gentle undulation everywhere else.
  height += smoothstep(-1.2, -2.4, z) * 0.18 * Math.abs(Math.sin(x * 2.1 + z * 1.3) * Math.cos(x * 1.7 - z * 2.3));
  height += 0.035 * Math.sin(x * 3.1 + 1.2) * Math.cos(z * 2.6);
  // Carve the bay.
  height -= BAY.depth * Math.exp(-((x - BAY.x) ** 2 + ((z - BAY.z) * 1.15) ** 2) / BAY.radius ** 2);
  // Sink toward the rim, so the island meets the sea along a real shoreline.
  const land = smoothstep(DIORAMA_RADIUS, shoreStart(x, z), distance);
  return height * land + SEA_FLOOR * (1 - land);
}

/**
 * The shoreline as (x, z) points, one per angle: the outermost land above the water line.
 * Inlets such as the bay come out as dips in the outline.
 */
export function coastline(samples = 96): Array<readonly [x: number, z: number]> {
  return Array.from({ length: samples }, (_, index) => {
    const angle = (index / samples) * Math.PI * 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    let shore = 0;
    for (let radius = 0; radius < DIORAMA_RADIUS; radius += 0.02) {
      if (terrainHeight(cos * radius, sin * radius) > WATER_LEVEL) shore = radius;
    }
    return [cos * shore, sin * shore] as const;
  });
}

/** Route control points (x, z), winding from the tram stop up to the miradouro. */
export const ROUTE_POINTS: ReadonlyArray<readonly [x: number, z: number]> = [
  [2.45, 2.35],
  [1.75, 2.45],
  [0.95, 2.05],
  [0.2, 1.75],
  [-0.35, 1.2],
  [-0.5, 0.55],
  [-0.15, 0.05],
  [0.25, -0.55],
  [0.55, -1.1],
  [1.1, -1.05],
  [1.3, -0.45],
];

/** Which route point each landmark sits beside, and how far to the side (+ is right of travel). */
export const STOPS: Record<SceneStopId, { point: number; side: number; label: string }> = {
  tram: { point: 0, side: 0.22, label: "Tram stop" },
  bakery: { point: 2, side: 0.34, label: "Bakery" },
  archway: { point: 4, side: 0, label: "Stone archway" },
  church: { point: 6, side: -0.42, label: "Bell tower" },
  castle: { point: 8, side: -0.4, label: "Castle wall" },
  miradouro: { point: 10, side: 0.2, label: "Miradouro" },
};

export const DEFAULT_ANCHORS: ReadonlyArray<SceneStopId> = SCENE_STOP_IDS;

/**
 * Route parameter (0–1, uniform per control point) for each journey step.
 * Anchored steps use their landmark; unanchored ones are spread between their neighbours.
 */
export function resolveStopFractions(anchors: ReadonlyArray<SceneStopId | null>): number[] {
  const last = ROUTE_POINTS.length - 1;
  const known = anchors.map((anchor) => (anchor ? STOPS[anchor].point / last : null));

  return known.map((value, index) => {
    if (value !== null) return value;
    let previous = index - 1;
    while (previous >= 0 && known[previous] === null) previous--;
    let next = index + 1;
    while (next < known.length && known[next] === null) next++;
    const from = previous >= 0 ? (known[previous] ?? 0) : 0;
    const to = next < known.length ? (known[next] ?? 1) : 1;
    return from + ((to - from) * (index - previous)) / (next - previous);
  });
}

/** Uniform Catmull–Rom sample of the route; `t` matches the 3D curve's `getPoint(t)`. */
export type RouteSample = { x: number; z: number; t: number };

export function sampleRoute(samplesPerSpan = 12): RouteSample[] {
  const spans = ROUTE_POINTS.length - 1;
  const samples: RouteSample[] = [];
  for (let span = 0; span < spans; span++) {
    const [p0, p1, p2, p3] = [routePoint(span - 1), routePoint(span), routePoint(span + 1), routePoint(span + 2)];
    for (let step = 0; step < samplesPerSpan; step++) {
      const u = step / samplesPerSpan;
      samples.push({ ...catmullRom(p0, p1, p2, p3, u), t: (span + u) / spans });
    }
  }
  const [x, z] = routePoint(spans);
  samples.push({ x, z, t: 1 });
  return samples;
}

type Point = readonly [number, number];

/** Control point by index, clamped to the ends of the route. */
export function routePoint(index: number): Point {
  const point = ROUTE_POINTS[Math.min(ROUTE_POINTS.length - 1, Math.max(0, index))];
  if (!point) throw new Error("The route needs at least one control point.");
  return point;
}

function catmullRom(p0: Point, p1: Point, p2: Point, p3: Point, u: number) {
  const u2 = u * u;
  const u3 = u2 * u;
  const axis = (i: 0 | 1) =>
    0.5 *
    (2 * p1[i] +
      (-p0[i] + p2[i]) * u +
      (2 * p0[i] - 5 * p1[i] + 4 * p2[i] - p3[i]) * u2 +
      (-p0[i] + 3 * p1[i] - 3 * p2[i] + p3[i]) * u3);
  return { x: axis(0), z: axis(1) };
}

/** Point on the sampled route at parameter `t`. */
export function routePointAt(samples: ReadonlyArray<RouteSample>, t: number): RouteSample {
  const clamped = Math.min(1, Math.max(0, t));
  const index = samples.findIndex((sample) => sample.t >= clamped);
  const a = samples[Math.max(0, index - 1)];
  const b = samples[Math.max(0, index)];
  if (!a || !b) return { x: 0, z: 0, t: clamped };
  const k = (clamped - a.t) / (b.t - a.t || 1);
  return { x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k, t: clamped };
}
