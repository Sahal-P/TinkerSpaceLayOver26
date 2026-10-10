import { encode } from "uqr";

import { cn } from "@/lib/utils";

const FINDER = 7;

/** Art-directed QR code: soft modules and rounded finder eyes, always dark on light so it scans. */
export function QrCode({ value, label, className }: { value: string; label: string; className?: string }) {
  const { data, size } = encode(value, { ecc: "M", border: 0 });
  const inFinder = (x: number, y: number) =>
    (x < FINDER && y < FINDER) || (x >= size - FINDER && y < FINDER) || (x < FINDER && y >= size - FINDER);

  let modules = "";
  data.forEach((row, y) =>
    row.forEach((on, x) => {
      if (on && !inFinder(x, y)) modules += `M${x + 0.17} ${y + 0.17}h0.66v0.66h-0.66z`;
    }),
  );

  const eyes: Array<[number, number]> = [
    [0, 0],
    [size - FINDER, 0],
    [0, size - FINDER],
  ];

  return (
    <svg role="img" aria-label={label} viewBox={`-4 -4 ${size + 8} ${size + 8}`} className={cn("rounded-card bg-qr-paper", className)}>
      <path d={modules} className="fill-qr-ink stroke-qr-ink" strokeWidth={0.17} strokeLinejoin="round" />
      {eyes.map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <rect x={x + 0.5} y={y + 0.5} width={6} height={6} rx={1.9} className="fill-none stroke-qr-ink" strokeWidth={1} />
          <rect x={x + 2} y={y + 2} width={3} height={3} rx={0.9} className="fill-qr-ink" />
        </g>
      ))}
    </svg>
  );
}
