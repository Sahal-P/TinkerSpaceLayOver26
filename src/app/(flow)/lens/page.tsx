import type { Metadata } from "next";

import { LensScreen } from "@/features/journey/components/lens/lens-screen";

export const metadata: Metadata = {
  title: "Lens check",
  description: "Compare what you see with the landmark the local described.",
};

export default function Page() {
  return <LensScreen />;
}
