import type { Direction } from "./guide";

/** Conservative positive clauses: never turn a prohibition into an instruction. */
function affirmativeClauses(text: string): string[] {
  return text
    .toLowerCase()
    .replaceAll("’", "'")
    .split(/[,.;!?]|\b(?:but|then)\b/)
    .filter(
      (clause) =>
        !/\b(?:don't|do not|never|cannot|can't|avoid|must not|not(?!\s+sure\b))\b/.test(
          clause,
        ),
    );
}
export function supportsTurn(text: string, side: "left" | "right"): boolean {
  const pattern = new RegExp(
    "\\b(?:turn|bear|keep|go|head|make|take)\\s+(?:(?:a|the|first|second|third|next|slight|slightly|to|your)\\s+){0,5}" +
      side +
      "\\b",
  );
  return affirmativeClauses(text).some((clause) => pattern.test(clause));
}
export function contradictoryTurns(text: string): boolean {
  return (
    supportsTurn(text, "left") &&
    supportsTurn(text, "right") &&
    /\b(or|either|not sure|don't know|do not know)\b/i.test(text)
  );
}
export function hedgedEvidence(text: string): boolean {
  return /\b(maybe|perhaps|think|not sure|might|possibly)\b/i.test(text);
}
export function supportsDirection(direction: Direction, text: string): boolean {
  const clauses = affirmativeClauses(text);
  switch (direction) {
    case "unknown":
      return true;
    case "left":
      return supportsTurn(text, "left");
    case "right":
      return supportsTurn(text, "right");
    case "slight_left":
      return clauses.some(
        (clause) =>
          supportsTurn(clause, "left") &&
          /\b(slight|slightly|bear)\b/.test(clause),
      );
    case "slight_right":
      return clauses.some(
        (clause) =>
          supportsTurn(clause, "right") &&
          /\b(slight|slightly|bear)\b/.test(clause),
      );
    case "u_turn":
      return clauses.some((clause) =>
        /\b(u[\s-]?turn|turn around|turn back)\b/.test(clause),
      );
    case "straight":
      return clauses.some(
        (clause) =>
          /\b(straight|ahead|forward|continue)\b/.test(clause) &&
          !/\bcontinue\s+(?:left|right)\b/.test(clause),
      );
    case "start":
      return clauses.some((clause) => /\b(start|begin|leave)\b/.test(clause));
    case "arrive":
      return clauses.some((clause) =>
        /\b(arrive|reach|destination|finish|end)\b/.test(clause),
      );
  }
}
export function supportsIncline(
  incline: "up" | "down" | null,
  text: string,
): boolean {
  if (incline === null) return true;
  const pattern =
    incline === "up"
      ? /\b(uphill|climb|ascend|up (?:the )?(?:hill|stairs|steps))\b/
      : /\b(downhill|descend|down (?:the )?(?:hill|stairs|steps))\b/;
  return affirmativeClauses(text).some((clause) => pattern.test(clause));
}
