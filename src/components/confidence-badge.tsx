import { Badge } from "@/components/ui/badge";
import { confidenceCopy, type Confidence } from "@/lib/wayfinding";

/** Review acknowledges the step; it does not increase confidence. */
export function ConfidenceBadge({
  level,
  reviewed = false,
  className,
}: {
  level: Confidence;
  reviewed?: boolean;
  className?: string;
}) {
  const copy = confidenceCopy[level];
  return (
    <Badge tone={copy.tone} className={className}>
      {copy.label}
      {reviewed ? " · reviewed" : ""}
    </Badge>
  );
}
