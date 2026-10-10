import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

const variants = {
  primary: "bg-accent text-on-accent hover:bg-accent-hover",
  secondary: "bg-surface-raised text-ink ring-1 ring-inset ring-line-strong hover:bg-surface-sunken",
  ghost: "text-ink hover:bg-surface-sunken",
  /** Light on photography and the feature panel, in every color scheme. */
  light: "bg-photo-ink text-scrim hover:bg-photo-ink/85",
} as const;

// Every size keeps at least a 44px touch target.
const sizes = {
  sm: "h-11 px-4 text-sm",
  md: "h-12 px-5 text-sm",
  lg: "h-14 px-7 text-base",
  icon: "size-11",
  "icon-lg": "size-14",
} as const;

export type ButtonVariant = keyof typeof variants;
export type ButtonSize = keyof typeof sizes;

type ButtonStyleOptions = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
};

/** Button classes, also for links that should look like buttons. */
export function buttonStyles({ variant = "primary", size = "md", className }: ButtonStyleOptions = {}) {
  return cn(
    "group/button inline-flex shrink-0 items-center justify-center gap-2 rounded-xl font-medium whitespace-nowrap select-none",
    "transition-[background-color,color,box-shadow,transform,opacity] duration-200 ease-out-soft active:scale-[0.97]",
    "disabled:pointer-events-none disabled:opacity-45 aria-disabled:pointer-events-none aria-disabled:opacity-45",
    variants[variant],
    sizes[size],
    className,
  );
}

type ButtonProps = ComponentProps<"button"> & Omit<ButtonStyleOptions, "className">;

export function Button({ variant, size, className, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={buttonStyles({ variant, size, className })} {...props} />;
}

const linkTones = {
  default: "decoration-line-strong",
  /** On the feature panel. */
  feature: "decoration-on-feature/50",
} as const;

/** Quiet underlined link for secondary actions; pairs with `arrowNudge` on a trailing icon. */
export function textLinkStyles({ tone = "default", className }: { tone?: keyof typeof linkTones; className?: string } = {}) {
  return cn(
    "group/button inline-flex min-h-11 items-center gap-2 font-medium underline decoration-1 underline-offset-[0.4em]",
    "transition-colors duration-200 hover:decoration-current",
    linkTones[tone],
    className,
  );
}

/** Nudges a trailing arrow on hover; place inside a button or button-styled link. */
export const arrowNudge = "transition-transform duration-300 ease-out-soft group-hover/button:translate-x-0.5";
