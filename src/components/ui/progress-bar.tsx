import { cn } from "@/lib/utils";

/** Hairline progress; `value` is 0–1. */
export function ProgressBar({ value, label, className }: { value: number; label: string; className?: string }) {
  const clamped = Math.min(1, Math.max(0, value));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}
      className={cn("h-0.5 overflow-hidden rounded-full bg-line", className)}
    >
      <div
        className="h-full origin-left bg-accent-ink transition-transform duration-500 ease-out-soft"
        style={{ transform: `scaleX(${clamped})` }}
      />
    </div>
  );
}
