import { cn } from "@/lib/utils";

/** A lens with a winding route inside it. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden className={cn("size-7", className)}>
      <circle cx="16" cy="16" r="14.25" className="stroke-current" strokeWidth="1.5" />
      <circle cx="16" cy="16" r="9.5" className="stroke-current" strokeOpacity="0.3" strokeWidth="1" />
      <path d="M8.5 21.5c3.75 0 3.25-6.5 7.5-6.5s3.75-5 7.5-5" className="stroke-accent" strokeWidth="2" strokeLinecap="round" />
      <circle cx="23.5" cy="10" r="2.25" className="fill-accent" />
    </svg>
  );
}

const wordmarkSizes = { md: "text-xl", sm: "text-lg" } as const;

export function Wordmark({ size = "md", className }: { size?: keyof typeof wordmarkSizes; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 font-display leading-none font-semibold", wordmarkSizes[size], className)}>
      <BrandMark />
      Local to Lens
    </span>
  );
}
