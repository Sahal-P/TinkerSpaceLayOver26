import type { GuideDraft, Step } from "./guide";
import { findEvidenceSpan } from "./evidence-span";
import { isFactFreeTransition, isNavigationTransition } from "./navigation-quality";

/** Join only exact neighboring quotes separated by punctuation/space, never missing route words. */
export function refineNavigationSteps(steps: Step[], transcript: GuideDraft["transcript"]): { steps: Step[]; warnings: string[] } {
  const result: Step[] = []; const warnings: string[] = [];
  let pending: Step | undefined;
  const locations = new Map<string, NonNullable<ReturnType<typeof findEvidenceSpan>>>();
  let originalMinimum = 0; let translationMinimum = 0;
  for (const step of steps) {
    if (step.source !== "audio" || !step.evidence) continue;
    const span = findEvidenceSpan(transcript, step.evidence, originalMinimum, translationMinimum);
    if (!span) return { steps, warnings: [] }; // Leave bad evidence for strict boundary rejection.
    locations.set(step.id, span); originalMinimum = span.originalEnd; translationMinimum = span.translationEnd;
  }
  const harmless = (step: Step) => step.landmark.spoken === null && step.landmark.label === null &&
    step.distance.spoken === null && step.distance.meters === null && step.incline === null;
  const join = (prefix: Step, action: Step): Step | null => {
    if (!prefix.evidence || !action.evidence || !harmless(prefix)) return null;
    const first = locations.get(prefix.id);
    if (!first) return null;
    const next = locations.get(action.id);
    if (!next || !/^[\s.,;:!?।–—-]*$/.test(transcript.original.slice(first.originalEnd, next.originalStart)) ||
      !/^[\s.,;:!?।–—-]*$/.test(transcript.translation.slice(first.translationEnd, next.translationStart))) return null;
    const evidence = { original: transcript.original.slice(first.originalStart, next.originalEnd),
      translation: transcript.translation.slice(first.translationStart, next.translationEnd), startSec: prefix.evidence.startSec };
    locations.set(action.id, { ...first, originalEnd: next.originalEnd, translationEnd: next.translationEnd });
    return { ...action, instruction: evidence.translation, evidence, reviewed: false,
      warnings: [...new Set([...prefix.warnings, ...action.warnings])],
      confidence: prefix.confidence === "low" || action.confidence === "low" ? "low"
        : prefix.confidence === "medium" || action.confidence === "medium" ? "medium" : "high",
      needsReview: prefix.needsReview || action.needsReview,
    };
  };
  const retainIncomplete = (step: Step) => {
    if (!harmless(step) || !isFactFreeTransition(step.instruction)) result.push(step); // Contract validation rejects losing a factual reference.
    else warnings.push("The recording contains a transition without an adjacent navigation action; ask the speaker for the missing instruction.");
  };
  for (const step of steps) {
    const transition = step.source === "audio" && isNavigationTransition(step.instruction);
    if (pending) {
      const combined = join(pending, step);
      if (combined) {
        if (transition) pending = combined;
        else { result.push(combined); pending = undefined; }
        continue;
      }
      retainIncomplete(pending); pending = undefined;
    }
    if (transition) pending = step;
    else result.push(step);
  }
  if (pending) retainIncomplete(pending);
  return { steps: result, warnings: [...new Set(warnings)] };
}
