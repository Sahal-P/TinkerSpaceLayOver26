// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Button, buttonStyles } from "./button";

describe("Button", () => {
  it("does not submit forms by default", () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole("button", { name: "Save" }).getAttribute("type")).toBe("button");
  });

  it("combines variant, size, and custom classes", () => {
    const classes = buttonStyles({ variant: "secondary", size: "lg", className: "w-full" });
    expect(classes).toContain("ring-line");
    expect(classes).toContain("h-13");
    expect(classes).toContain("w-full");
  });
});
