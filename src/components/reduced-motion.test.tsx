// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { Parallax } from "@/components/parallax";
import { RecordButton } from "@/features/journey/components/record/record-button";

// Simulate the OS "reduce motion" setting before Motion reads it.
beforeAll(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("reduced-motion"),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }));
});

describe("reduced motion", () => {
  it("drops the looping halo around the record button", () => {
    const { container } = render(<RecordButton recording onClick={() => {}} />);
    expect(screen.getByRole("button", { name: "Stop recording" })).toBeDefined();
    expect(container.querySelectorAll("span.bg-accent")).toHaveLength(0);
  });

  it("keeps parallax content still", () => {
    render(
      <Parallax offset={80}>
        <p>Still</p>
      </Parallax>,
    );
    const wrapper = screen.getByText("Still").parentElement;
    expect(wrapper?.style.transform ?? "").not.toMatch(/translateY\((?!0)/);
  });
});
