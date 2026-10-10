import { Badge } from "@/components/ui/badge";
import { confidenceCopy, type Confidence } from "@/lib/wayfinding";

/** How sure the AI is about a step. Reviewed uncertain steps read as checked. */
export function ConfidenceBadge({ level, reviewed = false, className }: { level: Confidence; reviewed?: boolean; className?: string }) {
  if (reviewed && level !== "high") {
    return (
      <Badge tone="positive" className={className}>
        Checked by you
      </Badge>
    );
  }
  const copy = confidenceCopy[level];
  return (
    <Badge tone={copy.tone} className={className}>
      {copy.label}
    </Badge>
  );
}
