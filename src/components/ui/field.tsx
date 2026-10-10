import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Shared look for inputs, textareas and selects. */
export const controlStyles = cn(
  "w-full rounded-2xl bg-surface-raised px-4 py-3 text-base text-ink ring-1 ring-line-strong ring-inset",
  "placeholder:text-ink-muted transition-shadow duration-200 aria-invalid:ring-2 aria-invalid:ring-critical",
);

type FieldProps = {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  className?: string;
  children: ReactNode;
};

/** Label + control + message. The control sets `aria-describedby={`${id}-message`}` when needed. */
export function Field({ id, label, error, hint, className, children }: FieldProps) {
  const message = error ?? hint;
  return (
    <div className={cn("grid gap-2", className)}>
      <label htmlFor={id} className="caps text-ink-muted">
        {label}
      </label>
      {children}
      {message ? (
        <p id={`${id}-message`} className={cn("text-sm", error ? "text-critical" : "text-ink-muted")}>
          {message}
        </p>
      ) : null}
    </div>
  );
}
