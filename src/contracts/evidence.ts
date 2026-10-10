import type { Direction } from "./guide";

export function supportsTurn(text: string, side: "left" | "right"): boolean {
  const positive = text.toLowerCase().replace(/\b(?:don't|do not|never)\s+[^,.;!?]{1,80}/g, "");
  return new RegExp("\\b(?:turn|bear|keep|go|head|make|take)\\s+(?:(?:a|the|first|second|third|next|slight|slightly|to|your)\\s+){0,5}" + side + "\\b").test(positive);
}
export function contradictoryTurns(text: string): boolean {
  return supportsTurn(text, "left") && supportsTurn(text, "right") && /\b(or|either|not sure|don't know|do not know)\b/i.test(text);
}
export function hedgedEvidence(text: string): boolean {
  return /\b(maybe|perhaps|think|not sure|might|possibly)\b/i.test(text);
}
export function supportsDirection(direction: Direction, text: string): boolean {
  text = text.toLowerCase();
  switch (direction) {
    case "unknown": return true;
    case "left": return supportsTurn(text, "left");
    case "right": return supportsTurn(text, "right");
    case "slight_left": return supportsTurn(text, "left") && /\b(slight|slightly|bear)\b/.test(text);
    case "slight_right": return supportsTurn(text, "right") && /\b(slight|slightly|bear)\b/.test(text);
    case "u_turn": return /\b(u[\s-]?turn|turn around|turn back)\b/.test(text) && !/\b(don't|do not|never)\b/.test(text);
    case "straight": return /\b(straight|ahead|forward|continue)\b/.test(text);
    case "start": return /\b(start|begin|from|leave)\b/.test(text);
    case "arrive": return /\b(arrive|reach|destination|finish|end)\b/.test(text);
  }
}
export function supportsIncline(incline: "up" | "down" | null, text: string): boolean {
  if (incline === null) return true;
  return incline === "up" ?
    /\b(uphill|climb|ascend|up (?:the )?(?:hill|stairs|steps))\b/i.test(text) :
    /\b(downhill|descend|down (?:the )?(?:hill|stairs|steps))\b/i.test(text);
}
