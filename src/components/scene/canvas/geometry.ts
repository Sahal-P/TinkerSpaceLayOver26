import * as THREE from "three";

import { DIORAMA_RADIUS, LIGHTHOUSE, ROUTE_POINTS, STOPS, WATER_LEVEL, terrainHeight } from "@/components/scene/layout";
import { sceneColors } from "@/components/scene/palette";
import { SCENE_STOP_IDS, type SceneStopId } from "@/components/scene/stops";
import { seededRandom } from "@/lib/format";

/* Shared unit geometries. Bases sit at y = 0 so scale sets height directly. */
export const unitBox = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
export const gable = createGable();
export const cypressCone = new THREE.ConeGeometry(0.055, 0.32, 6).translate(0, 0.16, 0);
export const treeCrown = new THREE.IcosahedronGeometry(0.1, 0).scale(1.15, 0.85, 1.15).translate(0, 0.17, 0);
export const treeTrunk = new THREE.CylinderGeometry(0.012, 0.016, 0.1, 5).translate(0, 0.05, 0);

/** Gable roof prism: 1 wide (x), 1 deep (z), 1 tall, ridge along x. */
function createGable() {
  const shape = new THREE.Shape([new THREE.Vector2(-0.5, 0), new THREE.Vector2(0.5, 0), new THREE.Vector2(0, 1)]);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false });
  geometry.rotateY(Math.PI / 2);
  geometry.translate(-0.5, 0, 0);
  geometry.computeVertexNormals();
  return geometry;
}

const terrainPalette = Object.fromEntries(
  Object.entries(sceneColors.terrain).map(([name, hex]) => [name, new THREE.Color(hex)]),
) as Record<keyof typeof sceneColors.terrain, THREE.Color>;

/** Faces this far out are shoreline: low ones read as beach, however steep. */
const COAST_RADIUS = DIORAMA_RADIUS - 0.75;

function terrainColor(height: number, slope: number, jitter: number, coastal: boolean): THREE.Color {
  const c = terrainPalette;
  if (height < WATER_LEVEL + 0.06 || (coastal && height < 0.25)) return c.sand;
  if (height > 2.05) return c.snow;
  if (height > 1.05 || slope < 0.6) return jitter > 0.45 ? c.rock : c.rockDeep;
  if (height > 0.75) return jitter > 0.5 ? c.moss : c.meadowDeep;
  return jitter > 0.62 ? c.meadowDeep : c.meadow;
}

/** Faceted, flat-shaded terrain disc on a polar grid, colored per face by height and slope. */
export function createTerrainGeometry(rings: number, segments: number): THREE.BufferGeometry {
  const positions: number[] = [0, terrainHeight(0, 0), 0];
  for (let ring = 1; ring <= rings; ring++) {
    const radius = (ring / rings) * DIORAMA_RADIUS;
    for (let segment = 0; segment < segments; segment++) {
      // Offset alternate rings for even-looking triangles.
      const angle = ((segment + (ring % 2) * 0.5) / segments) * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      positions.push(x, terrainHeight(x, z), z);
    }
  }

  const vertex = (ring: number, segment: number) => 1 + (ring - 1) * segments + (segment % segments);
  const indices: number[] = [];
  for (let segment = 0; segment < segments; segment++) indices.push(0, vertex(1, segment + 1), vertex(1, segment));
  for (let ring = 1; ring < rings; ring++) {
    for (let segment = 0; segment < segments; segment++) {
      const a = vertex(ring, segment);
      const b = vertex(ring, segment + 1);
      const c = vertex(ring + 1, segment);
      const d = vertex(ring + 1, segment + 1);
      indices.push(a, b, c, b, d, c);
    }
  }

  const indexed = new THREE.BufferGeometry();
  indexed.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  indexed.setIndex(indices);
  const geometry = indexed.toNonIndexed();
  indexed.dispose();

  const position = geometry.getAttribute("position") as THREE.BufferAttribute;
  const colors = new Float32Array(position.count * 3);
  const random = seededRandom(3);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();
  const normal = new THREE.Vector3();

  for (let i = 0; i < position.count; i += 3) {
    a.fromBufferAttribute(position, i);
    b.fromBufferAttribute(position, i + 1);
    c.fromBufferAttribute(position, i + 2);
    normal.crossVectors(ab.subVectors(b, a), ac.subVectors(c, a));
    if (normal.y < 0) {
      // Make every face point up so back-face culling keeps it.
      position.setXYZ(i + 1, c.x, c.y, c.z);
      position.setXYZ(i + 2, b.x, b.y, b.z);
      normal.negate();
    }
    normal.normalize();
    const coastal = Math.hypot((a.x + b.x + c.x) / 3, (a.z + b.z + c.z) / 3) > COAST_RADIUS;
    const color = terrainColor((a.y + b.y + c.y) / 3, normal.y, random(), coastal);
    const shade = 0.95 + random() * 0.09;
    for (let k = 0; k < 3; k++) colors.set([color.r * shade, color.g * shade, color.b * shade], (i + k) * 3);
  }

  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

/** A flat strip that follows the curve and hugs the terrain. Six indices per segment. */
export function createRibbon(curve: THREE.Curve<THREE.Vector3>, samples: number, width: number, lift: number) {
  const positions = new Float32Array((samples + 1) * 6);
  const up = new THREE.Vector3(0, 1, 0);
  const point = new THREE.Vector3();
  const tangent = new THREE.Vector3();
  const side = new THREE.Vector3();

  for (let i = 0; i <= samples; i++) {
    const u = i / samples;
    curve.getPointAt(u, point);
    curve.getTangentAt(u, tangent);
    side.crossVectors(tangent, up).setY(0).normalize().multiplyScalar(width / 2);
    for (const [k, sign] of [
      [0, 1],
      [1, -1],
    ] as const) {
      const x = point.x + side.x * sign;
      const z = point.z + side.z * sign;
      positions.set([x, terrainHeight(x, z) + lift, z], (i * 2 + k) * 3);
    }
  }

  const indices: number[] = [];
  for (let i = 0; i < samples; i++) {
    const a = i * 2;
    indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export type StopFrame = {
  position: THREE.Vector3;
  /** Yaw that points local +z along the direction of travel. */
  along: number;
  /** Yaw that points local +z at the path. */
  facing: number;
};

export type RouteModel = {
  curve: THREE.CatmullRomCurve3;
  /** Converts a route parameter (as in `getPoint`) to an arc-length fraction (as in `getPointAt`). */
  arcAt: (t: number) => number;
  frames: Record<SceneStopId, StopFrame>;
  samples: THREE.Vector3[];
};

export function createRouteModel(): RouteModel {
  const curve = new THREE.CatmullRomCurve3(
    ROUTE_POINTS.map(([x, z]) => new THREE.Vector3(x, terrainHeight(x, z) + 0.03, z)),
    false,
    "centripetal",
  );
  const divisions = 400;
  const lengths = curve.getLengths(divisions);
  const total = lengths[divisions] ?? 1;
  const arcAt = (t: number) => (lengths[Math.round(THREE.MathUtils.clamp(t, 0, 1) * divisions)] ?? total) / total;
  const last = ROUTE_POINTS.length - 1;

  const frames = {} as Record<SceneStopId, StopFrame>;
  for (const id of SCENE_STOP_IDS) {
    const { point, side } = STOPS[id];
    const t = point / last;
    const center = curve.getPoint(t);
    const tangent = curve.getTangent(t).setY(0).normalize();
    const right = new THREE.Vector3(-tangent.z, 0, tangent.x);
    const position = center.clone().addScaledVector(right, side);
    position.y = terrainHeight(position.x, position.z);
    const along = Math.atan2(tangent.x, tangent.z);
    const facing = side === 0 ? along : Math.atan2(center.x - position.x, center.z - position.z);
    frames[id] = { position, along, facing };
  }

  return { curve, arcAt, frames, samples: curve.getSpacedPoints(180) };
}

function distanceToRoute(samples: ReadonlyArray<THREE.Vector3>, x: number, z: number) {
  let best = Infinity;
  let nearest = samples[0];
  for (const sample of samples) {
    const distance = Math.hypot(sample.x - x, sample.z - z);
    if (distance < best) {
      best = distance;
      nearest = sample;
    }
  }
  return { distance: best, nearest };
}

function pick<T>(items: ReadonlyArray<T>, random: () => number): T {
  const item = items[Math.floor(random() * items.length)] ?? items[0];
  if (item === undefined) throw new Error("Cannot pick from an empty list.");
  return item;
}

export type HousePlacement = {
  x: number;
  y: number;
  z: number;
  yaw: number;
  width: number;
  height: number;
  depth: number;
  plaster: string;
  roof: string;
};

/** Houses cluster along the route, face it, and keep clear of the path and landmarks. */
export function scatterHouses(route: RouteModel, count: number): HousePlacement[] {
  const random = seededRandom(21);
  const landmarks = Object.values(route.frames).map((frame) => frame.position);
  const houses: HousePlacement[] = [];

  for (let attempt = 0; houses.length < count && attempt < count * 40; attempt++) {
    const anchor = route.samples[Math.floor(random() * route.samples.length)];
    if (!anchor) continue;
    const angle = random() * Math.PI * 2;
    const reach = 0.28 + random() * 0.7;
    const x = anchor.x + Math.cos(angle) * reach;
    const z = anchor.z + Math.sin(angle) * reach;
    const y = terrainHeight(x, z);
    if (y < WATER_LEVEL + 0.12 || y > 1.15 || Math.hypot(x, z) > DIORAMA_RADIUS - 0.35) continue;
    const { distance, nearest } = distanceToRoute(route.samples, x, z);
    if (distance < 0.2 || !nearest) continue;
    if (landmarks.some((p) => Math.hypot(p.x - x, p.z - z) < 0.45)) continue;
    if (houses.some((house) => Math.hypot(house.x - x, house.z - z) < 0.23)) continue;
    houses.push({
      x,
      y: y - 0.02,
      z,
      yaw: Math.atan2(nearest.x - x, nearest.z - z),
      width: 0.15 + random() * 0.09,
      height: 0.13 + random() * 0.1,
      depth: 0.14 + random() * 0.07,
      plaster: pick(sceneColors.plaster, random),
      roof: pick(sceneColors.roof, random),
    });
  }
  return houses;
}

export type TreePlacement = { x: number; y: number; z: number; scale: number; kind: "cypress" | "round"; color: string };

/** Cypresses on the slopes, rounder trees lower down; never on the path, in water or on rock. */
export function scatterTrees(route: RouteModel, houses: ReadonlyArray<HousePlacement>, count: number): TreePlacement[] {
  const random = seededRandom(5);
  const landmarks = [...Object.values(route.frames).map((frame) => frame.position), new THREE.Vector3(LIGHTHOUSE.x, 0, LIGHTHOUSE.z)];
  const trees: TreePlacement[] = [];

  for (let attempt = 0; trees.length < count && attempt < count * 50; attempt++) {
    const radius = Math.sqrt(random()) * (DIORAMA_RADIUS - 0.3);
    const angle = random() * Math.PI * 2;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const y = terrainHeight(x, z);
    if (y < WATER_LEVEL + 0.1 || y > 1.45) continue;
    if (distanceToRoute(route.samples, x, z).distance < 0.17) continue;
    if (houses.some((house) => Math.hypot(house.x - x, house.z - z) < 0.17)) continue;
    if (landmarks.some((p) => Math.hypot(p.x - x, p.z - z) < 0.34)) continue;
    const kind = y > 0.5 || random() > 0.55 ? "cypress" : "round";
    trees.push({
      x,
      y: y - 0.01,
      z,
      kind,
      scale: 0.75 + random() * 0.6,
      color: pick(kind === "cypress" ? sceneColors.cypress : sceneColors.foliage, random),
    });
  }
  return trees;
}
