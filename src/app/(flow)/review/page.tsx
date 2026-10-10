import type { Metadata } from "next";

import { ReviewScreen } from "@/features/journey/components/review/review-screen";

export const metadata: Metadata = {
  title: "Review",
  description: "Check the transcript and edit each landmark step.",
};

export default function Page() {
  return <ReviewScreen />;
}
