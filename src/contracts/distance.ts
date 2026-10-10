/** Normalize only explicit English distance phrases, never time or vague references. */
const small: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
  fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};
const numberWords = "(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|half|quarter|a|and)";
const distancePattern = new RegExp(
  "(?<![\\w.])((?:\\d+(?:,\\d{3})*(?:\\.\\d+)?)|(?:" + numberWords +
  "(?:[\\s-]+" + numberWords + "){0,10}))\\s*(meters?|metres?|kilometers?|kilometres?|feet|foot|miles?|yards?|km|m|ft|mi)\\b", "gi",
);
const factors: Record<string, number> = {
  meter: 1, meters: 1, metre: 1, metres: 1, m: 1,
  kilometer: 1000, kilometers: 1000, kilometre: 1000, kilometres: 1000, km: 1000,
  feet: 0.3048, foot: 0.3048, ft: 0.3048, mile: 1609.344, miles: 1609.344, mi: 1609.344,
  yard: 0.9144, yards: 0.9144,
};

function numberValue(text: string): number | null {
  if (/^\d/.test(text)) return Number(text.replaceAll(",", ""));
  const fraction = text.match(/^(.*) and a (half|quarter)$/i);
  if (fraction?.[1]) {
    const whole = numberValue(fraction[1]);
    return whole === null ? null : whole + (fraction[2] === "half" ? 0.5 : 0.25);
  }
  const words = text.toLowerCase().split(/[\s-]+/).filter((word) => word !== "and");
  if (words.length === 1 && words[0] === "half") return 0.5;
  if (words.length === 1 && words[0] === "quarter") return 0.25;
  if (words.length === 2 && words[0] === "a" && words[1] === "half") return 0.5;
  if (words.length === 2 && words[0] === "a" && words[1] === "quarter") return 0.25;
  if (words.length === 2 && words[0] === "half" && words[1] === "a") return 0.5;
  if (words.length === 2 && words[0] === "quarter" && words[1] === "a") return 0.25;
  let total = 0;
  let group = 0;
  let last = -1;
  for (const [index, word] of words.entries()) {
    if (word === "a") {
      if (words.length !== 1 && !["hundred", "thousand"].includes(words[index + 1] ?? "")) return null;
      group = 1;
    } else if (word === "hundred") {
      if (group < 1 || group > 9) return null;
      group *= 100;
      last = -1;
    } else if (word === "thousand") {
      if (group < 1 || group >= 1000) return null;
      total += group * 1000;
      group = 0;
      last = -1;
    } else {
      const value = small[word];
      if (value === undefined || (last >= 0 && !(last >= 20 && last % 10 === 0 && value > 0 && value < 10))) return null;
      group += value;
      last = value;
    }
  }
  return total + group;
}

export function explicitDistances(text: string): number[] {
  const values: number[] = [];
  for (const match of text.matchAll(distancePattern)) {
    const quantity = match[1];
    const unit = match[2];
    if (!quantity || !unit) continue;
    const value = numberValue(quantity);
    const factor = factors[unit.toLowerCase()];
    if (value === null || factor === undefined) continue;
    const meters = Math.round(value * factor * 1_000_000) / 1_000_000;
    if (Number.isFinite(meters) && meters >= 0 && meters <= 1_000_000) values.push(meters);
  }
  return values;
}

export function normalizeDistance(text: string | null): number | null {
  if (!text) return null;
  if (/\b(?:between\s+\w+|(?:\w+|\d)\s+or\s+(?:\w+|\d))\b|\d\s*(?:to|[-–])\s*\d/i.test(text)) return null;
  const values = [...new Set(explicitDistances(text))];
  return values.length === 1 ? (values[0] ?? null) : null;
}
