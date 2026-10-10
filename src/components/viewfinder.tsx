import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

const corners = [
  "top-0 left-0 border-t-2 border-l-2 rounded-tl-2xl",
  "top-0 right-0 border-t-2 border-r-2 rounded-tr-2xl",
  "bottom-0 left-0 border-b-2 border-l-2 rounded-bl-2xl",
  "bottom-0 right-0 border-b-2 border-r-2 rounded-br-2xl",
];

type ViewfinderProps = {
  children: ReactNode;
  /** Brackets tighten around the subject while analyzing. */
  locked?: boolean;
  topLeft?: ReactNode;
  topRight?: ReactNode;
  bottom?: ReactNode;
  className?: string;
};

/** Camera framing: rule-of-thirds grid, corner brackets and caption slots over any content. */
export function Viewfinder({ children, locked = false, topLeft, topRight, bottom, className }: ViewfinderProps) {
  return (
    <div className={cn("relative isolate overflow-hidden rounded-panel bg-surface-inverse text-ink-inverse", className)}>
      {children}
      <div aria-hidden className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
        {Array.from({ length: 9 }, (_, index) => (
          <span key={index} className="border-r border-b border-ink-inverse/10 last:border-0 [&:nth-child(3n)]:border-r-0 [&:nth-child(n+7)]:border-b-0" />
        ))}
      </div>
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute transition-[inset] duration-700 ease-out-soft",
          locked ? "inset-[18%]" : "inset-5",
        )}
      >
        {corners.map((corner) => (
          <span key={corner} className={cn("absolute size-9 border-ink-inverse", corner)} />
        ))}
      </div>
      {topLeft || topRight ? (
        <div className="caps pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between px-9 pt-8 text-ink-inverse">
          {[topLeft, topRight].map((caption, index) =>
            caption ? (
              <span key={index} className="rounded-full bg-surface-inverse/70 px-2.5 py-1">
                {caption}
              </span>
            ) : (
              <span key={index} />
            ),
          )}
        </div>
      ) : null}
      {bottom ? <div className="absolute inset-x-0 bottom-0 p-4">{bottom}</div> : null}
    </div>
  );
}
