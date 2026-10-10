import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { BrandMark } from "@/components/brand-mark";
import { arrowNudge, buttonStyles } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function NotFound() {
  return (
    <main id="main" className="grid min-h-dvh place-items-center px-gutter py-16 text-center">
      <div className="max-w-lg">
        <BrandMark className="mx-auto size-12" />
        <p className="caps mt-8 text-ink-muted">Off the map</p>
        <h1 className="mt-5 font-display text-headline text-balance">Even locals get lost.</h1>
        <p className="mt-5 text-lg text-ink-muted">This page isn&rsquo;t on the route. Head back and start from somewhere familiar.</p>
        <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/" className={buttonStyles({ size: "lg" })}>
            Back to home
          </Link>
          <Link href="/record" className={buttonStyles({ variant: "secondary", size: "lg" })}>
            Start recording
            <ArrowRight aria-hidden className={cn("size-5", arrowNudge)} />
          </Link>
        </div>
      </div>
    </main>
  );
}
