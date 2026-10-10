"use client";

import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { setColorScheme, useColorScheme } from "@/lib/use-color-scheme";

export function ThemeToggle() {
  const scheme = useColorScheme();
  const next = scheme === "dark" ? "light" : "dark";
  const Icon = next === "dark" ? Moon : Sun;

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      onClick={() => setColorScheme(next)}
    >
      <Icon aria-hidden className="size-5" />
    </Button>
  );
}
