import type { Route } from "next";

/** The screens of the journey flow, in order, with where "Back" leads from each. */
export const FLOW_STEPS = [
  { id: "record", href: "/record", label: "Record", back: "/" },
  { id: "processing", href: "/processing", label: "Shape", back: "/record" },
  { id: "review", href: "/review", label: "Review", back: "/record" },
  { id: "guide", href: "/guide", label: "Guide", back: "/review" },
  { id: "lens", href: "/lens", label: "Lens check", back: "/guide" },
  { id: "share", href: "/share", label: "Share", back: "/guide" },
] as const satisfies ReadonlyArray<{ id: string; href: Route; label: string; back: Route }>;

export type FlowStep = (typeof FLOW_STEPS)[number];

export function flowStepFor(pathname: string): { step: FlowStep; index: number } | null {
  const index = FLOW_STEPS.findIndex((step) => pathname === step.href || pathname.startsWith(`${step.href}/`));
  const step = FLOW_STEPS[index];
  return step ? { step, index } : null;
}
