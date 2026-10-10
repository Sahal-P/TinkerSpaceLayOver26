import { Aperture } from "lucide-react";
import Link from "next/link";

import { Container } from "@/components/ui/container";
import { siteConfig } from "@/config/site";

export function SiteHeader() {
  return (
    <header className="pt-[max(1rem,env(safe-area-inset-top))]">
      <Container className="flex h-14 items-center">
        <Link href="/" className="inline-flex items-center gap-2 rounded-full font-display text-lg font-semibold">
          <Aperture aria-hidden className="size-5 text-accent" />
          {siteConfig.name}
        </Link>
      </Container>
    </header>
  );
}
