import { ClosingCta } from "@/features/landing/components/closing-cta";
import { FeaturedRoute } from "@/features/landing/components/featured-route";
import { Hero } from "@/features/landing/components/hero";
import { HowItWorks } from "@/features/landing/components/how-it-works";
import { LensFeature } from "@/features/landing/components/lens-feature";
import { SiteFooter } from "@/features/landing/components/site-footer";
import { SiteHeader } from "@/features/landing/components/site-header";

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main id="main" tabIndex={-1} className="outline-none">
        <Hero />
        <FeaturedRoute />
        <HowItWorks />
        <LensFeature />
        <ClosingCta />
      </main>
      <SiteFooter />
    </>
  );
}
