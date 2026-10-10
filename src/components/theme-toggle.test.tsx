// @vitest-environment jsdom

import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ThemeToggle } from "@/components/theme-toggle";
import { THEME_STORAGE_KEY, themeInitScript } from "@/lib/theme";

afterEach(() => {
  delete document.documentElement.dataset.theme;
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("navbar color scheme", () => {
  it("switches both ways and restores the saved choice before hydration", () => {
    document.documentElement.dataset.theme = "light";
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole("button", { name: "Switch to dark mode" }));
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");

    delete document.documentElement.dataset.theme;
    window.eval(themeInitScript);
    expect(document.documentElement.dataset.theme).toBe("dark");

    fireEvent.click(screen.getByRole("button", { name: "Switch to light mode" }));
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
  });

  it("keeps switching when browser storage is blocked", () => {
    document.documentElement.dataset.theme = "light";
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("Storage blocked");
    });
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole("button", { name: "Switch to dark mode" }));
    expect(screen.getByRole("button", { name: "Switch to light mode" })).toBeDefined();
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("syncs another tab's preference and ignores invalid saved values", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "invalid");
    window.eval(themeInitScript);
    expect(document.documentElement.dataset.theme).toBeUndefined();
    render(<ThemeToggle />);
    act(() => window.dispatchEvent(new StorageEvent("storage", { key: THEME_STORAGE_KEY, newValue: "dark" })));
    expect(screen.getByRole("button", { name: "Switch to light mode" })).toBeDefined();
  });
});
