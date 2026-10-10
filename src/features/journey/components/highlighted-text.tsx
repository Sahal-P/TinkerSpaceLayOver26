import { Fragment } from "react";

import { cn } from "@/lib/utils";

/** Renders `text` with each phrase underlined in the accent color, the way landmarks are marked in transcripts. */
export function HighlightedText({ text, phrases, className }: { text: string; phrases: ReadonlyArray<string>; className?: string }) {
  const parts: Array<{ value: string; marked: boolean }> = [];
  let rest = text;
  for (const phrase of phrases) {
    const at = phrase ? rest.toLowerCase().indexOf(phrase.toLowerCase()) : -1;
    if (at < 0) continue;
    parts.push({ value: rest.slice(0, at), marked: false }, { value: rest.slice(at, at + phrase.length), marked: true });
    rest = rest.slice(at + phrase.length);
  }
  parts.push({ value: rest, marked: false });

  return (
    <span className={className}>
      {parts.map((part, index) =>
        part.marked ? (
          <mark
            key={index}
            className={cn("bg-transparent text-inherit underline decoration-accent decoration-2 underline-offset-4")}
          >
            {part.value}
          </mark>
        ) : (
          <Fragment key={index}>{part.value}</Fragment>
        ),
      )}
    </span>
  );
}
