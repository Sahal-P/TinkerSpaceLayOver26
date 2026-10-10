import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// `server-only` throws outside the React Server Components runtime. Tests import
// server modules directly, so stub it here; Next.js still enforces it in builds.
vi.mock("server-only", () => ({}));

afterEach(() => {
  cleanup();
});
