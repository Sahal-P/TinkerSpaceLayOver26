import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Primary actions pinned to the bottom on phones; inline on larger screens. */
export function ActionBar({ children, note, className }: { children: ReactNode; note?: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "sticky bottom-0 z-20 -mx-gutter mt-10 border-t border-line bg-surface px-gutter pt-4 pb-safe",
        "md:static md:mx-0 md:border-0 md:bg-transparent md:px-0 md:pb-0",
        className,
      )}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        {note ? <div className="text-sm text-ink-muted">{note}</div> : <span className="hidden md:block" />}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{children}</div>
      </div>
    </div>
  );
}
