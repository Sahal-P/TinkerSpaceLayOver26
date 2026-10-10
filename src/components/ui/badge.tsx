import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import type { Tone } from "@/lib/wayfinding";

const tones: Record<Tone, { badge: string; dot: string }> = {
  neutral: { badge: "bg-surface-sunken text-ink", dot: "bg-ink-muted" },
  accent: { badge: "bg-accent-soft text-accent-ink", dot: "bg-accent" },
  positive: { badge: "bg-positive-soft text-positive", dot: "bg-positive" },
  caution: { badge: "bg-caution-soft text-caution", dot: "bg-caution" },
  critical: { badge: "bg-critical-soft text-critical", dot: "bg-critical" },
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium whitespace-nowrap",
        tones[tone].badge,
        className,
      )}
    >
      <span aria-hidden className={cn("size-1.5 rounded-full", tones[tone].dot)} />
      {children}
    </span>
  );
}
