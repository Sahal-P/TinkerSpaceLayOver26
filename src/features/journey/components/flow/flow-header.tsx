"use client";

import { ArrowLeft, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { ThemeToggle } from "@/components/theme-toggle";
import { Wordmark } from "@/components/brand-mark";
import { buttonStyles } from "@/components/ui/button";
import { FLOW_STEPS, flowStepFor } from "@/features/journey/flow";
import { cn } from "@/lib/utils";

/** Back, where you are in the flow, and a way out, on every screen. */
export function FlowHeader() {
  const pathname = usePathname();
  const current = flowStepFor(pathname);
  const index = current?.index ?? 0;

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-3 px-gutter">
        <Link href={current?.step.back ?? "/"} className={buttonStyles({ variant: "ghost", size: "icon", className: "-ml-2.5" })}>
          <ArrowLeft aria-hidden className="size-5" />
          <span className="sr-only">Back</span>
        </Link>
        <Link href="/" className="hidden rounded-lg sm:inline-flex" aria-label="Local to Lens home">
          <Wordmark size="sm" />
        </Link>
        <p className="min-w-0 flex-1 truncate text-center text-sm sm:ml-6 sm:text-left">
          <span className="font-medium">{current?.step.label}</span>
          <span className="ml-2 text-ink-muted">
            {index + 1} of {FLOW_STEPS.length}
          </span>
        </p>
        <ThemeToggle />
        <Link href="/" className={buttonStyles({ variant: "ghost", size: "icon", className: "-mr-2.5" })}>
          <X aria-hidden className="size-5" />
          <span className="sr-only">Close and return home</span>
        </Link>
      </div>
      <ol aria-label="Progress" className="mx-auto flex w-full max-w-7xl gap-1.5 px-gutter pb-3">
        {FLOW_STEPS.map((step, stepIndex) => (
          <li key={step.id} className="flex-1" aria-current={stepIndex === index ? "step" : undefined}>
            <span className="sr-only">
              {step.label}
              {stepIndex < index ? " (done)" : stepIndex === index ? " (current)" : ""}
            </span>
            <span
              aria-hidden
              className={cn(
                "block h-0.5 rounded-full transition-colors duration-500",
                stepIndex < index ? "bg-ink" : stepIndex === index ? "bg-accent-ink" : "bg-line-strong",
              )}
            />
            <span aria-hidden className={cn("caps mt-2 hidden md:block", stepIndex === index ? "text-ink" : "text-ink-muted")}>
              {step.label}
            </span>
          </li>
        ))}
      </ol>
    </header>
  );
}
