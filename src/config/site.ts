/** Public, non-secret site metadata. */
export const siteConfig = {
  name: "Local to Lens",
  description:
    "Record moments as you travel. Local to Lens turns them into a personal, shareable travel guide.",
  // Browser UI colors must be literals; keep in sync with --surface in src/styles/tokens.css.
  themeColor: { light: "#faf7f2", dark: "#0c0a09" },
} as const;
