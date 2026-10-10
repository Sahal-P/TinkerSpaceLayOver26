// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import HomePage from "./page";

describe("HomePage", () => {
  it("renders the hero and the three-step flow", () => {
    render(<HomePage />);

    expect(screen.getByRole("heading", { level: 1, name: "Your trip, told like a local." })).toBeDefined();
    for (const step of ["Record", "Shape", "Share"]) {
      expect(screen.getByRole("heading", { level: 3, name: step })).toBeDefined();
    }
    expect(screen.getByRole("link", { name: "See how it works" }).getAttribute("href")).toBe("#how-it-works");
  });
});
