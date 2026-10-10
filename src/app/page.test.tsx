// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import HomePage from "./page";

describe("HomePage", () => {
  it("tells the story and leads into the flow", () => {
    render(<HomePage />);

    expect(screen.getByRole("heading", { level: 1, name: /ask a local,\s*follow the lens\./i })).toBeDefined();
    for (const chapter of ["Record the moment", "Gemini shapes the route", "Follow landmark by landmark", "Pass it on"]) {
      expect(screen.getByRole("heading", { level: 3, name: chapter })).toBeDefined();
    }
    const starts = screen.getAllByRole("link", { name: /start recording/i });
    expect(starts.every((link) => link.getAttribute("href") === "/record")).toBe(true);
  });

  it("opens the demo guide at the landmark on each photo card", () => {
    render(<HomePage />);

    const card = screen.getByRole("link", { name: /bakery with blue tiles/i });
    expect(card.getAttribute("href")).toBe("/guide?step=2");
    expect(card.querySelector("img")?.getAttribute("alt")).toMatch(/azulejo/i);
  });

  it("shows the illustrated fallback when WebGL is unavailable", () => {
    render(<HomePage />);
    // jsdom has no WebGL, so the scene renders its 2D illustration.
    expect(screen.getByRole("img", { name: /miniature island town/i }).querySelector("svg")).not.toBeNull();
  });
});
