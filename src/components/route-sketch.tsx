import {
  BAY,
  DEFAULT_ANCHORS,
  DIORAMA_RADIUS,
  LIGHTHOUSE,
  MOUNTAINS,
  TOWN_HILL,
  WATER_LEVEL,
  coastline,
  resolveStopFractions,
  routePointAt,
  sampleRoute,
  terrainHeight,
  type RouteSample,
} from "@/components/scene/layout";
import type { SceneStopId } from "@/components/scene/stops";
import { seededRandom } from "@/lib/format";
import { cn } from "@/lib/utils";

type Variant = "landscape" | "map";
type Projection = (x: number, z: number, y?: number) => readonly [number, number];

const AZIMUTH = 0.72;
const COS = Math.cos(AZIMUTH);
const SIN = Math.sin(AZIMUTH);

const projections: Record<Variant, Projection> = {
  // Oblique view matching the 3D camera, so the fallback reads as the same place.
  landscape: (x, z, y = 0) => [400 + (x * COS - z * SIN) * 82, 320 + (x * SIN + z * COS) * 41 - y * 56],
  map: (x, z) => [200 + x * 33, 150 + z * 33],
};

const viewBoxes: Record<Variant, string> = { landscape: "0 0 800 560", map: "0 0 400 300" };

const ROUTE = sampleRoute(14);

function toPath(points: ReadonlyArray<readonly [number, number]>, close = false): string {
  return points.map(([x, y], index) => `${index ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join("") + (close ? "Z" : "");
}

function projectRoute(variant: Variant, sample: RouteSample): readonly [number, number] {
  return projections[variant](sample.x, sample.z, terrainHeight(sample.x, sample.z) + 0.04);
}

/** Route path plus cumulative length, so stop positions line up with the drawn stroke. */
function buildRoute(variant: Variant) {
  const points = ROUTE.map((sample) => projectRoute(variant, sample));
  const lengths = [0];
  for (let index = 1; index < points.length; index++) {
    const [ax, ay] = points[index - 1] ?? [0, 0];
    const [bx, by] = points[index] ?? [0, 0];
    lengths.push((lengths[index - 1] ?? 0) + Math.hypot(bx - ax, by - ay));
  }
  const total = lengths.at(-1) || 1;
  const arcFraction = (t: number) => {
    const index = ROUTE.findIndex((sample) => sample.t >= t);
    return (lengths[Math.max(0, index)] ?? total) / total;
  };
  return { d: toPath(points), arcFraction };
}

const routes = { landscape: buildRoute("landscape"), map: buildRoute("map") };

/** Height bands for the landscape fallback, echoing the 3D terrain colors. */
const BANDS = [
  { above: 0.15, tone: "fill-earth-meadow" },
  { above: 0.6, tone: "fill-earth-meadow-deep" },
  { above: 1.05, tone: "fill-earth-rock" },
  { above: 2.05, tone: "fill-earth-snow" },
] as const;

/**
 * Back-to-front terrain slices for the landscape fallback. Each slice is filled in height
 * bands (only where the land rises above a band), with a hairline along its ridge, so the
 * hills read like layered contours and low ground stays a single flat shape.
 */
const landscapeLayers = (() => {
  const project = projections.landscape;
  const layers: Array<{ depth: number; fills: Array<{ d: string; tone: string }>; ridge: string }> = [];
  for (let depth = -DIORAMA_RADIUS + 0.2; depth < DIORAMA_RADIUS; depth += 0.3) {
    const half = Math.sqrt(DIORAMA_RADIUS ** 2 - depth ** 2);
    const profile = Array.from({ length: 61 }, (_, step) => {
      const right = -half + (2 * half * step) / 60;
      const x = right * COS + depth * SIN;
      const z = -right * SIN + depth * COS;
      return { x, z, height: terrainHeight(x, z) };
    });

    const fills: Array<{ d: string; tone: string }> = [];
    const ridges: string[] = [];
    for (const band of BANDS) {
      let run: typeof profile = [];
      const flush = () => {
        if (run.length > 1) {
          const top = run.map((point) => project(point.x, point.z, point.height));
          const base = run.toReversed().map((point) => project(point.x, point.z, band.above));
          fills.push({ d: toPath([...top, ...base], true), tone: band.tone });
          if (band === BANDS[0]) ridges.push(toPath(top));
        }
        run = [];
      };
      for (const point of profile) {
        if (point.height > band.above) run.push(point);
        else flush();
      }
      flush();
    }
    if (fills.length) layers.push({ depth, fills, ridge: ridges.join("") });
  }
  return layers;
})();

/** Shoreline outline (drawn at ground level), optionally inset to leave a beach. */
const COAST = coastline(120);
const shorePath = (variant: Variant, inset = 0) =>
  toPath(
    COAST.map(([x, z]) => {
      const scale = Math.max(0, 1 - inset / Math.max(Math.hypot(x, z), 0.01));
      return projections[variant](x * scale, z * scale, 0);
    }),
    true,
  );

const bayOutline = (variant: Variant) =>
  toPath(
    Array.from({ length: 48 }, (_, index) => {
      const angle = (index / 48) * Math.PI * 2;
      const x = BAY.x + Math.cos(angle) * BAY.radius * 0.78;
      const z = BAY.z + (Math.sin(angle) * BAY.radius * 0.78) / 1.15;
      return projections[variant](x, z, WATER_LEVEL);
    }),
    true,
  );

/** A scatter of little houses along the route for the landscape view. */
const houses = (() => {
  const random = seededRandom(11);
  const result: Array<{ x: number; y: number; scale: number }> = [];
  ROUTE.forEach((sample, index) => {
    if (index % 7 !== 3) return;
    for (const side of [-1, 1]) {
      const x = sample.x + side * (0.35 + random() * 0.3);
      const z = sample.z + (random() - 0.5) * 0.4;
      const height = terrainHeight(x, z);
      if (height < WATER_LEVEL + 0.1 || Math.hypot(x, z) > DIORAMA_RADIUS - 0.4) continue;
      const [sx, sy] = projections.landscape(x, z, height);
      result.push({ x: sx, y: sy, scale: 0.8 + random() * 0.5 });
    }
  });
  return result.sort((a, b) => a.y - b.y);
})();

type RouteSketchProps = {
  variant: Variant;
  stops?: ReadonlyArray<SceneStopId | null>;
  activeIndex?: number;
  /** Portion of the route drawn in the accent color (0–1). Defaults to the active stop, or the whole route. */
  progress?: number;
  onSelectStop?: (index: number) => void;
  /** Draw the route in from the start (respects reduced motion). */
  animateDraw?: boolean;
  title?: string;
  className?: string;
};

/** 2D illustration of the miniature world: the WebGL fallback and the share-card map. */
export function RouteSketch({
  variant,
  stops = DEFAULT_ANCHORS,
  activeIndex,
  progress,
  onSelectStop,
  animateDraw = false,
  title,
  className,
}: RouteSketchProps) {
  const project = projections[variant];
  const route = routes[variant];
  const fractions = resolveStopFractions(stops);
  const drawn = progress ?? (activeIndex === undefined ? 1 : route.arcFraction(fractions[activeIndex] ?? 1));
  const landscape = variant === "landscape";
  const radius = landscape ? 11 : 7;

  return (
    <svg
      viewBox={viewBoxes[variant]}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className={cn("h-full w-full", className)}
      preserveAspectRatio="xMidYMid meet"
    >
      {landscape ? <LandscapeBackdrop /> : <MapBackdrop />}

      <path d={route.d} className="fill-none stroke-surface-raised" strokeWidth={landscape ? 9 : 6} strokeLinecap="round" strokeLinejoin="round" />
      <path d={route.d} className="fill-none stroke-ink" strokeOpacity={0.35} strokeWidth={landscape ? 2 : 1.5} strokeDasharray="2 6" strokeLinecap="round" />
      <path
        d={route.d}
        pathLength={1}
        className={cn(
          "fill-none stroke-accent-ink transition-[stroke-dashoffset] duration-1000 ease-out-soft",
          animateDraw && "motion-safe:animate-draw",
        )}
        strokeWidth={landscape ? 3.5 : 2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="1 1"
        strokeDashoffset={1 - drawn}
      />

      {fractions.map((fraction, index) => {
        const point = routePointAt(ROUTE, fraction);
        const [cx, cy] = project(point.x, point.z, terrainHeight(point.x, point.z) + 0.04);
        const isLast = index === fractions.length - 1;
        const state = activeIndex === undefined ? "idle" : index < activeIndex ? "done" : index === activeIndex ? "active" : "next";
        return (
          <g
            key={index}
            onClick={onSelectStop ? () => onSelectStop(index) : undefined}
            className={cn(onSelectStop && "cursor-pointer")}
          >
            {state === "active" ? <circle cx={cx} cy={cy} r={radius + 7} className="fill-accent" fillOpacity={0.18} /> : null}
            {isLast ? (
              <g transform={`translate(${cx} ${cy - radius * 0.4}) scale(${landscape ? 1 : 0.65})`}>
                <path d="M0 0s-14-12-14-24a14 14 0 0 1 28 0C14-12 0 0 0 0Z" className="fill-accent-ink" />
                <circle cy={-24} r={5} className="fill-surface-raised" />
              </g>
            ) : (
              <>
                <circle
                  cx={cx}
                  cy={cy}
                  r={radius}
                  className={cn(
                    state === "active" ? "fill-accent stroke-accent-ink" : state === "done" ? "fill-ink stroke-ink" : "fill-surface-raised stroke-ink",
                  )}
                  strokeWidth={1.25}
                />
                <text
                  x={cx}
                  y={cy}
                  dy="0.35em"
                  textAnchor="middle"
                  className={cn(
                    "font-mono",
                    state === "active" ? "fill-on-accent" : state === "done" ? "fill-surface" : "fill-ink",
                  )}
                  fontSize={landscape ? 11 : 8}
                >
                  {index + 1}
                </text>
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function LandscapeBackdrop() {
  const project = projections.landscape;
  const [cx, cy] = project(0, 0, WATER_LEVEL);
  const lighthouse = project(LIGHTHOUSE.x, LIGHTHOUSE.z, terrainHeight(LIGHTHOUSE.x, LIGHTHOUSE.z));

  return (
    <g>
      <defs>
        <radialGradient id="route-sketch-sea">
          <stop offset="0.55" className="[stop-color:var(--color-water)]" stopOpacity={0.55} />
          <stop offset="1" className="[stop-color:var(--color-water)]" stopOpacity={0} />
        </radialGradient>
      </defs>
      <ellipse cx={cx} cy={cy} rx={DIORAMA_RADIUS * 82 * 1.45} ry={DIORAMA_RADIUS * 41 * 1.6} fill="url(#route-sketch-sea)" />
      <path d={shorePath("landscape")} className="fill-earth-sand" />
      <path d={shorePath("landscape", 0.16)} className="fill-earth-meadow" />
      {landscapeLayers.map((layer) => (
        <g key={layer.depth}>
          {layer.fills.map((fill, index) => (
            <path key={index} d={fill.d} className={fill.tone} />
          ))}
          <path d={layer.ridge} className="fill-none stroke-ink" strokeOpacity={0.14} strokeWidth={1} />
        </g>
      ))}
      {houses.map((house, index) => (
        <g key={index} transform={`translate(${house.x} ${house.y}) scale(${house.scale})`}>
          <path d="M-7 0V-9H7V0Z" className="fill-surface-raised" />
          <path d="M-8.5-8.5 0-15 8.5-8.5Z" className="fill-earth-clay" />
        </g>
      ))}
      <g transform={`translate(${lighthouse[0]} ${lighthouse[1]})`}>
        <path d="M-5 0-3.5-34H3.5L5 0Z" className="fill-surface-raised" />
        <path d="M-4.4-12H4.4L4.1-20H-4.1Z" className="fill-accent" />
        <rect x={-4} y={-41} width={8} height={7} rx={1.5} className="fill-ink" />
      </g>
    </g>
  );
}

function MapBackdrop() {
  const project = projections.map;
  const contours = [...MOUNTAINS, TOWN_HILL].flatMap(([x, z, , radius]) =>
    [0.3, 0.6, 0.9].map((k) => ({ x, z, r: radius * k * 33 })),
  );

  return (
    <g>
      <path d={shorePath("map")} className="fill-none stroke-line-strong" strokeWidth={1} />
      {contours.map((ring, index) => {
        const [cx, cy] = project(ring.x, ring.z);
        return <circle key={index} cx={cx} cy={cy} r={ring.r} className="fill-none stroke-line-strong" strokeWidth={0.75} />;
      })}
      <path d={bayOutline("map")} className="fill-water stroke-line-strong" strokeWidth={0.75} />
      <g transform="translate(366 30)" className="stroke-ink" strokeOpacity={0.5}>
        <circle r={11} className="fill-none" strokeWidth={0.75} />
        <path d="M0-8 3 3 0 1-3 3Z" className="fill-ink" fillOpacity={0.5} />
      </g>
    </g>
  );
}
