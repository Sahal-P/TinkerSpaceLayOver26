const simpleTransitions = /^(?:then|next|after that|from there|from here|once there|once here)$/;
const dependentTransition = /^(?:(?:after|before|when|once|if|as|upon|on)\s+(?:(?:you|we|the bus|the train)\s+)?(?:reach(?:ing|ed)?|arriv(?:e|es|ed|ing)|get(?:ting)?|are|have reached|have arrived)|having\s+(?:reached|arrived|got))\b(.*)$/;
function transitionPhrase(text: string): string { return text.trim().toLowerCase().replace(/[\s.,;:!?।]+$/, ""); }

/** Dependent transitions are context for an action, never standalone route cards. */
export function isNavigationTransition(text: string): boolean {
  const phrase = transitionPhrase(text);
  if (simpleTransitions.test(phrase)) return true;
  if (/[,.;!?।]/.test(phrase)) return false;
  const dependent = phrase.match(dependentTransition);
  if (!dependent) return false;
  return !/\b(?:turn|take|board|catch|go|walk|continue|stop|wait|ask|cross|follow|head|keep|climb|descend|use|enter|exit|look|change|transfer|find|leave|finish|start|get off)\b/.test(dependent[1] ?? "");
}

/** Missing model fields must not hide a spoken name, quantity or transport reference. */
export function isFactFreeTransition(text: string): boolean {
  const phrase = transitionPhrase(text);
  if (simpleTransitions.test(phrase)) return true;
  if (!isNavigationTransition(text) || /\b(?:bus|train)\b/.test(phrase)) return false;
  const tail = phrase.match(dependentTransition)?.[1]?.trim().replace(/^(?:at|to|in)\s+/, "");
  return tail !== undefined && ["", "there", "here", "that place", "that spot"].includes(tail);
}

/** Do not guess what an unnamed place refers to from the route's earlier steps. */
export function hasUnresolvedPlaceReference(instruction: string, landmark: string | null): boolean {
  const text = instruction.toLowerCase();
  const withoutName = landmark ? text.replaceAll(landmark.toLowerCase(), "") : text;
  const references = withoutName.replace(/\bthere\s+(?:is|are|was|were|will be|may be|might be)\b/g, "");
  return /\b(?:there|here|that place|that spot)\b/.test(references);
}
