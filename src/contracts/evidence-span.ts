import type { GuideDraft, Step } from "./guide";

type Transcript = GuideDraft["transcript"];
type Evidence = NonNullable<Step["evidence"]>;
type Span = { originalStart: number; originalEnd: number; translationStart: number; translationEnd: number };

/** A quote may cross adjacent segments only when both languages cover the same segment span. */
export function findEvidenceSpan(
  transcript: Transcript, evidence: Evidence, originalMinimum = 0, translationMinimum = 0,
): Span | null {
  let originalOffset = 0; let translationOffset = 0;
  const bounds = transcript.segments.map(segment => {
    const result = { segment, originalStart: originalOffset, originalEnd: originalOffset + segment.original.length,
      translationStart: translationOffset, translationEnd: translationOffset + segment.translation.length };
    originalOffset = result.originalEnd + 1; translationOffset = result.translationEnd + 1;
    return result;
  });
  for (let offset = transcript.original.indexOf(evidence.original, originalMinimum); offset >= 0;
    offset = transcript.original.indexOf(evidence.original, offset + 1)) {
    const end = offset + evidence.original.length;
    const first = bounds.findIndex(bound => offset >= bound.originalStart && offset < bound.originalEnd);
    const last = bounds.findIndex(bound => end > bound.originalStart && end <= bound.originalEnd);
    const startBound = bounds[first]; const endBound = bounds[last];
    if (!startBound || !endBound || last < first ||
      (evidence.startSec !== null && evidence.startSec !== startBound.segment.startSec)) continue;
    const translationStart = transcript.translation.indexOf(evidence.translation, Math.max(translationMinimum, startBound.translationStart));
    const translationEnd = translationStart + evidence.translation.length;
    if (translationStart < startBound.translationStart || translationStart >= startBound.translationEnd ||
      translationEnd <= endBound.translationStart || translationEnd > endBound.translationEnd) continue;
    return { originalStart: offset, originalEnd: end, translationStart, translationEnd };
  }
  return null;
}
