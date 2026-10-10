import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export const LENS_VIEWS = ["tram", "bakery", "archway", "church", "stairs", "kiosk", "street"] as const;
export type LensView = (typeof LENS_VIEWS)[number];

/** Illustrated stand-ins for camera photos in the mocked Lens check. */
export function LensArt({ view, className }: { view: LensView; className?: string }) {
  return (
    <svg viewBox="0 0 300 400" preserveAspectRatio="xMidYMid slice" aria-hidden className={cn("h-full w-full", className)}>
      <rect width="300" height="400" className="fill-earth-snow" />
      <path d="M0 250 70 205l60 22 70-40 100 50V400H0Z" className="fill-earth-meadow-deep" opacity={0.5} />
      {scenes[view]}
      <path d="M0 330h300v70H0Z" className="fill-earth-sand" />
      <path
        d="M0 352h300M0 376h300M40 330l-20 70M110 330l-10 70M190 330l10 70M260 330l20 70"
        className="stroke-earth-clay"
        strokeOpacity={0.5}
      />
    </svg>
  );
}

const scenes: Record<LensView, ReactNode> = {
  tram: (
    <g>
      <rect x="40" y="200" width="220" height="118" rx="26" className="fill-earth-clay" />
      <rect x="40" y="200" width="220" height="74" rx="26" className="fill-accent-vivid" opacity={0.85} />
      {[62, 112, 162, 212].map((x) => (
        <rect key={x} x={x} y="218" width="36" height="38" rx="6" className="fill-ink" opacity={0.75} />
      ))}
      <rect x="52" y="288" width="196" height="10" className="fill-surface-raised" />
      <path d="M150 200v-40M130 160h40" className="stroke-ink" strokeWidth="3" />
      <path d="M60 330l-20 40M240 330l20 40" className="stroke-ink" strokeWidth="4" />
    </g>
  ),
  bakery: (
    <g>
      <rect x="30" y="120" width="240" height="212" className="fill-surface-raised" />
      <g className="fill-water">
        {Array.from({ length: 6 }, (_, row) =>
          Array.from({ length: 8 }, (_, column) => (
            <rect key={`${row}-${column}`} x={34 + column * 29} y={124 + row * 22} width="25" height="18" opacity={(row + column) % 2 ? 0.8 : 0.5} />
          )),
        )}
      </g>
      <path d="M40 252h220l-14 26H54Z" className="fill-accent-vivid" />
      <rect x="60" y="282" width="70" height="50" className="fill-ink" opacity={0.75} />
      <rect x="160" y="282" width="80" height="40" className="fill-earth-clay" opacity={0.6} />
    </g>
  ),
  archway: (
    <g>
      <path d="M20 140h260v192h-70v-90a60 60 0 0 0-120 0v90H20Z" className="fill-earth-rock" />
      <path d="M20 140h260v16H20Z" className="fill-earth-rock-deep" />
      <path d="M90 332v-90a60 60 0 0 1 120 0v90Z" className="fill-earth-meadow-deep" opacity={0.35} />
      <path d="M40 200h40M40 260h30M220 200h40M230 260h30" className="stroke-earth-rock-deep" />
    </g>
  ),
  church: (
    <g>
      <rect x="58" y="96" width="50" height="236" className="fill-surface-raised" />
      <path d="M52 98 83 52l31 46Z" className="fill-earth-clay" />
      <path d="M72 150a11 11 0 0 1 22 0v26H72Z" className="fill-ink" opacity={0.8} />
      <path d="M83 52V36M77 42h12" className="stroke-ink" strokeWidth="2" />
      <rect x="108" y="170" width="150" height="162" className="fill-surface-raised" />
      <path d="M102 172 183 118l81 54Z" className="fill-earth-clay" />
      <circle cx="183" cy="196" r="13" className="fill-water stroke-earth-rock" strokeWidth="3" />
      <path d="M160 332v-58a23 23 0 0 1 46 0v58Z" className="fill-earth-rock-deep" />
      <path d="M274 332V246M268 246h12v14h-12Z" className="fill-accent-vivid stroke-ink" strokeWidth="2" />
    </g>
  ),
  stairs: (
    <g>
      <path d="M0 120h22v-14h18v14h22v-14h18v14h22v-14h18v14h10v212H0Z" className="fill-earth-rock" />
      <path d="M0 160h130M0 205h130M0 250h130M0 295h130M40 120v212M90 120v212" className="stroke-earth-rock-deep" strokeOpacity={0.5} />
      {Array.from({ length: 7 }, (_, index) => (
        <rect
          key={index}
          x={130 + index * 14}
          y={318 - index * 22}
          width={170 - index * 14}
          height={22}
          className="fill-earth-sand stroke-earth-clay"
          strokeOpacity={0.6}
        />
      ))}
      <path d="M250 180h50v60h-50Z" className="fill-earth-rock-deep" opacity={0.7} />
    </g>
  ),
  kiosk: (
    <g>
      <path d="M0 232h300" className="stroke-ink" strokeWidth="3" />
      {[20, 60, 100, 200, 240, 280].map((x) => (
        <path key={x} d={`M${x} 232v30`} className="stroke-ink" strokeWidth="3" />
      ))}
      <rect x="112" y="182" width="76" height="110" rx="6" className="fill-surface-inverse" />
      <rect x="120" y="206" width="60" height="34" className="fill-ink" opacity={0.7} />
      <path d="M100 184h100l-50-44Z" className="fill-ink" opacity={0.85} />
      <circle cx="150" cy="136" r="5" className="fill-accent-vivid" />
      <path d="M0 150c60-20 120 10 180-6s90-10 120 0" className="fill-none stroke-water" strokeWidth="18" />
    </g>
  ),
  street: (
    <g>
      <rect x="20" y="110" width="120" height="222" className="fill-surface-raised" />
      <rect x="150" y="80" width="130" height="252" className="fill-earth-sand" />
      {[0, 1, 2].map((row) =>
        [0, 1].map((column) => (
          <g key={`${row}-${column}`}>
            <rect x={40 + column * 52} y={135 + row * 60} width={30} height={40} className="fill-ink" opacity={0.75} />
            <rect x={170 + column * 56} y={110 + row * 66} width={34} height={44} className="fill-ink" opacity={0.75} />
            <path d={`M${166 + column * 56} ${158 + row * 66}h42`} className="stroke-ink" strokeWidth="3" />
          </g>
        )),
      )}
      <circle cx="40" cy="300" r="34" className="fill-earth-meadow-deep" />
      <rect x="170" y="300" width="96" height="30" rx="12" className="fill-water" />
    </g>
  ),
};
