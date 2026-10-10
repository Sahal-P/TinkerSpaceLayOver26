import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

const sizes = {
  sm: "max-w-xl",
  md: "max-w-3xl",
  lg: "max-w-6xl",
  xl: "max-w-7xl",
} as const;

type ContainerProps = ComponentProps<"div"> & { size?: keyof typeof sizes };

/** Centered page column; side padding respects device safe areas. */
export function Container({ size = "lg", className, ...props }: ContainerProps) {
  return <div className={cn("mx-auto w-full px-gutter", sizes[size], className)} {...props} />;
}
