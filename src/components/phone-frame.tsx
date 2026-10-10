import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Device mockup for showing real UI in marketing sections. */
export function PhoneFrame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "relative mx-auto aspect-[9/19] w-full max-w-72 rounded-device bg-surface-inverse p-2 shadow-lifted ring-1 ring-line-inverse",
        className,
      )}
    >
      <div className="relative h-full overflow-hidden rounded-[2.35rem] bg-surface">{children}</div>
      <span aria-hidden className="absolute top-4 left-1/2 h-5 w-20 -translate-x-1/2 rounded-full bg-surface-inverse" />
    </div>
  );
}
