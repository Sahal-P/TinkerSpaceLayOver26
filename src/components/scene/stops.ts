/** Landmarks in the miniature world, in route order. Journey steps anchor to these. */
export const SCENE_STOP_IDS = ["tram", "bakery", "archway", "church", "castle", "miradouro"] as const;
export type SceneStopId = (typeof SCENE_STOP_IDS)[number];
