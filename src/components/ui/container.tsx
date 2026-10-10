import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

/** Centered page column; side padding respects device safe areas. */
export function Container({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("mx-auto w-full max-w-5xl px-gutter", className)} {...props} />;
}
