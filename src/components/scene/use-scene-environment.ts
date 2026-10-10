import { useSyncExternalStore } from "react";

const subscribeNever = () => () => {};

let webglSupport: boolean | undefined;

function detectWebGL(): boolean {
  if (webglSupport !== undefined) return webglSupport;
  // `?no-webgl` forces the static fallback, for testing.
  if (new URLSearchParams(window.location.search).has("no-webgl") || typeof WebGLRenderingContext === "undefined") {
    webglSupport = false;
    return webglSupport;
  }
  try {
    const canvas = document.createElement("canvas");
    // Skip software renderers: the fallback looks better than a stuttering scene.
    const options = { failIfMajorPerformanceCaveat: true };
    webglSupport = Boolean(canvas.getContext("webgl2", options) ?? canvas.getContext("webgl", options));
  } catch {
    webglSupport = false;
  }
  return webglSupport;
}

/** `null` until hydrated (server and first client render agree), then whether WebGL is usable. */
export function useWebGLSupport(): boolean | null {
  return useSyncExternalStore(subscribeNever, detectWebGL, () => null);
}

// The scene uses the same persisted preference as the navbar and CSS tokens.
export { useColorScheme } from "@/lib/use-color-scheme";
