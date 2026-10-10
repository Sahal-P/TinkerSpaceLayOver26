import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type ScreenIntroProps = {
  title: ReactNode;
  children?: ReactNode;
  className?: string;
};

/** Screen opener: display headline and a short lede. The flow header already names the step. */
export function ScreenIntro({ title, children, className }: ScreenIntroProps) {
  return (
    <div className={cn("max-w-xl", className)}>
      <h1 className="font-display text-title text-balance">{title}</h1>
      {children ? <p className="mt-4 text-lg text-pretty text-ink-muted">{children}</p> : null}
    </div>
  );
}
