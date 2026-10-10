/*
 * Scene palette. WebGL can't read CSS variables, so these mirror the palette in
 * src/styles/tokens.css. `background` is the sea haze and must match --sea for each color scheme.
 */

export type SceneTheme = {
  name: "day" | "night";
  background: string;
  /** The open sea; rendered without tone mapping so it fades exactly into `background`. */
  water: string;
  /** Paler shallows around the shore, fading out to open water. */
  shallows: string;
  /** Fog near/far as multiples of the camera distance. */
  fog: [near: number, far: number];
  hemisphere: { sky: string; ground: string; intensity: number };
  key: { color: string; intensity: number; position: [number, number, number] };
  fill: { color: string; intensity: number };
  exposure: number;
  /** Emissive strength for windows, lanterns and the lighthouse. */
  glow: number;
  /** Self-lighting for clouds: soft by day, barely there at night. */
  cloudGlow: number;
  /** Route, traveler, destination pin and focus rings. */
  highlight: string;
  highlightGlow: number;
};

export const sceneColors = {
  terrain: {
    sand: "#f2efe7",
    meadow: "#98b4c7",
    meadowDeep: "#7e9fb4",
    moss: "#6f92a7",
    rock: "#4b6b7c",
    rockDeep: "#3d5a80",
    snow: "#ffffff",
  },
  plaster: ["#ffffff", "#f2efe7", "#eaf2f8", "#d8e6f2", "#c8d9e6", "#d9e4e9"],
  roof: ["#3d5a80", "#4b6b7c", "#6a879d", "#34576b"],
  stone: "#d8e6f2",
  stoneDeep: "#98b4c7",
  ink: "#0d1b2a",
  /** Teal and steel blue: awnings, stripes, trims and the kiosk. */
  accent: "#4b6b7c",
  /** Airy blue: the tram and lantern housings. */
  flame: "#98b4c7",
  navy: "#3d5a80",
  tile: "#4b6b7c",
  foliage: ["#c8d9e6", "#7e9fb4", "#98b4c7"],
  cypress: ["#4b6b7c", "#1b263b", "#3d5a80"],
  trunk: "#4b6b7c",
  window: "#0d1b2a",
  windowGlow: "#f2efe7",
  path: "#ffffff",
  cloud: "#ffffff",
  sail: "#f2efe7",
  lantern: "#f2efe7",
  /** Neutral multiplier for vertex colors and instance tints. */
  materialBase: "#ffffff",
} as const;

export const dayTheme: SceneTheme = {
  name: "day",
  background: "#c8d9e6",
  water: "#98b4c7",
  shallows: "#eaf2f8",
  fog: [1.05, 2.2],
  hemisphere: { sky: "#ffffff", ground: "#98b4c7", intensity: 1.15 },
  key: { color: "#f2efe7", intensity: 3, position: [6, 9, 4.5] },
  fill: { color: "#c8d9e6", intensity: 0.45 },
  exposure: 1,
  glow: 0,
  cloudGlow: 0.5,
  highlight: "#4b6b7c",
  highlightGlow: 0.25,
};

export const nightTheme: SceneTheme = {
  name: "night",
  background: "#1b263b",
  water: "#3d5a80",
  shallows: "#476078",
  fog: [1, 2],
  hemisphere: { sky: "#3d5a80", ground: "#0d1b2a", intensity: 0.95 },
  key: { color: "#c8d9e6", intensity: 1.4, position: [-5, 8, 3] },
  fill: { color: "#98b4c7", intensity: 0.35 },
  exposure: 1.2,
  glow: 3.2,
  cloudGlow: 0.05,
  highlight: "#c8d9e6",
  highlightGlow: 1.1,
};
