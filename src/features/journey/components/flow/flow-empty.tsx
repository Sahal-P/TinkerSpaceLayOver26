"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, buttonStyles } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { useJourney } from "@/features/journey/journey-store";
import { ScreenIntro } from "./screen-intro";

export function FlowEmpty({ needsReview = false }: { needsReview?: boolean }) {
  const { dispatch } = useJourney();
  const router = useRouter();
  return (
    <Container size="lg" className="flex-1 py-12">
      <ScreenIntro
        title={
          needsReview
            ? "Review your directions first."
            : "Start with a recording."
        }
      >
        {needsReview
          ? "Confirm the steps and acknowledge uncertainty before following the guide."
          : "Live guides stay in memory for this visit. Record or upload directions, or explicitly explore a demo."}
      </ScreenIntro>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href={needsReview ? "/review" : "/record"}
          className={buttonStyles()}
        >
          {needsReview ? "Review directions" : "Record directions"}
        </Link>
        <Button
          variant="secondary"
          onClick={() => {
            const raw = new URL(window.location.href).searchParams.get("step");
            const startIndex = raw && /^\d+$/.test(raw) ? Number(raw) - 1 : 0;
            dispatch({ type: "demo/loaded", startIndex });
            router.push("/review");
          }}
        >
          Explore demo
        </Button>
      </div>
    </Container>
  );
}
export function DeferredFeature({
  feature,
}: {
  feature: "Sharing" | "Lens check";
}) {
  return (
    <Container size="lg" className="flex-1 py-12">
      <ScreenIntro title={`${feature} is coming later.`}>
        Your live guide is temporary and stays in memory. No{" "}
        {feature === "Sharing"
          ? "guide has been saved or published"
          : "photo has been analyzed"}
        . Continue following the reviewed directions.
      </ScreenIntro>
      <Link href="/guide" className={buttonStyles({ className: "mt-8" })}>
        Back to guide
      </Link>
    </Container>
  );
}
