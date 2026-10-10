import { describe, expect, it } from "vitest";

import {
  DIORAMA_RADIUS,
  ROUTE_POINTS,
  STOPS,
  WATER_LEVEL,
  coastline,
  resolveStopFractions,
  routePointAt,
  sampleRoute,
  terrainHeight,
} from "./layout";

describe("terrainHeight", () => {
  it("sinks below the sea at the rim, even under the mountains", () => {
    expect(terrainHeight(DIORAMA_RADIUS, 0)).toBeLessThan(WATER_LEVEL);
    expect(terrainHeight(0, -DIORAMA_RADIUS + 0.01)).toBeLessThan(WATER_LEVEL);
  });

  it("keeps the whole route and every landmark on dry land", () => {
    for (const sample of sampleRoute(8)) expect(terrainHeight(sample.x, sample.z)).toBeGreaterThan(WATER_LEVEL + 0.05);
    for (const stop of Object.values(STOPS)) {
      const [x, z] = ROUTE_POINTS[stop.point] ?? [0, 0];
      expect(terrainHeight(x, z)).toBeGreaterThan(WATER_LEVEL + 0.05);
    }
  });

  it("climbs from the tram stop to the miradouro", () => {
    const [start, end] = [ROUTE_POINTS[0], ROUTE_POINTS.at(-1)];
    if (!start || !end) throw new Error("Route needs points");
    expect(terrainHeight(...end)).toBeGreaterThan(terrainHeight(...start) + 0.5);
  });
});

describe("coastline", () => {
  it("traces a shore inside the terrain disc, with the bay as an inlet", () => {
    const radii = coastline(48).map(([x, z]) => Math.hypot(x, z));
    expect(radii).toHaveLength(48);
    expect(Math.max(...radii)).toBeLessThan(DIORAMA_RADIUS);
    expect(Math.min(...radii)).toBeGreaterThan(1.5);
    expect(radii.filter((radius) => radius > 3.4).length).toBeGreaterThan(36);
  });
});

describe("resolveStopFractions", () => {
  it("places anchored stops at their landmark", () => {
    expect(resolveStopFractions(["tram", "miradouro"])).toEqual([0, 1]);
  });

  it("spreads unanchored steps between their neighbours", () => {
    const [, middle, end] = resolveStopFractions(["tram", null, "church"]);
    expect(end).toBeCloseTo(0.6);
    expect(middle).toBeCloseTo(0.3);
    expect(resolveStopFractions([null, null])).toEqual([1 / 3, 2 / 3]);
  });
});

describe("route sampling", () => {
  it("runs from t = 0 to t = 1 through the control points", () => {
    const samples = sampleRoute(8);
    expect(samples[0]?.t).toBe(0);
    expect(samples.at(-1)?.t).toBe(1);
    const start = ROUTE_POINTS[0];
    expect(routePointAt(samples, 0)).toMatchObject({ x: start?.[0], z: start?.[1] });
  });
});
