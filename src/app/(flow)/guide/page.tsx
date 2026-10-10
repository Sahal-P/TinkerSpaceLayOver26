import type { Metadata } from "next";
import { Suspense } from "react";

import { GuideScreen } from "@/features/journey/components/guide/guide-screen";
import { StepFromQuery } from "@/features/journey/components/guide/step-from-query";

export const metadata: Metadata = {
  title: "Guide",
  description: "Follow the route landmark by landmark.",
};

export default function Page() {
  return (
    <>
      {/* Reading the query string opts only this tiny leaf out of static rendering. */}
      <Suspense fallback={null}>
        <StepFromQuery />
      </Suspense>
      <GuideScreen />
    </>
  );
}
