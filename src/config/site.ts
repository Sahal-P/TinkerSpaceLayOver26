/** Public, non-secret site metadata. */
export const siteConfig = {
  name: "Local to Lens",
  description:
    "Record the directions a local gives you, in any language. Local to Lens turns them into a landmark-by-landmark guide you can follow, check with your camera, and share.",
  // Browser UI colors must be literals; keep in sync with --surface in src/styles/tokens.css.
  themeColor: { light: "#f2efe7", dark: "#0d1b2a" },
} as const;
