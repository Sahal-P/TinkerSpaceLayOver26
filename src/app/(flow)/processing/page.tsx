import type { Metadata } from "next";

import { ProcessingScreen } from "@/features/journey/components/processing/processing-screen";

export const metadata: Metadata = {
  title: "Shaping your route",
  description: "Transcribing, translating and mapping the directions.",
};

export default function Page() {
  return <ProcessingScreen />;
}
