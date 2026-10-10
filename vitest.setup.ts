import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// `server-only` throws outside the React Server Components runtime. Tests import
// server modules directly, so stub it here; Next.js still enforces it in builds.
vi.mock("server-only", () => ({}));

// jsdom has no layout observers; Motion's viewport and scroll hooks need them to exist.
if (typeof window !== "undefined") {
  class NoopObserver {
    readonly root = null;
    readonly rootMargin = "";
    readonly thresholds: number[] = [];
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  }
  vi.stubGlobal("IntersectionObserver", NoopObserver);
  vi.stubGlobal("ResizeObserver", NoopObserver);
}

afterEach(() => {
  cleanup();
});
