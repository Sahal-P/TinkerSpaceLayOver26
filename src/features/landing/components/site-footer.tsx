import Link from "next/link";

import { Wordmark } from "@/components/brand-mark";
import { Container } from "@/components/ui/container";
import { photoCredits } from "@/config/photos";

const links = [
  { href: "/record", label: "Record" },
  { href: "/guide", label: "Demo guide" },
  { href: "/lens", label: "Lens check" },
  { href: "/share", label: "Share" },
] as const;

export function SiteFooter() {
  return (
    <footer className="border-t border-line pt-14 pb-[max(2.5rem,env(safe-area-inset-bottom))]">
      <Container size="xl" className="grid gap-10 md:grid-cols-[1fr_auto]">
        <div>
          <Wordmark />
          <p className="mt-4 max-w-xs text-sm text-ink-muted">For travelers who would rather look up than type.</p>
        </div>
        <nav aria-label="Footer">
          <ul className="flex flex-wrap gap-x-8 gap-y-1 text-sm">
            {links.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="inline-flex min-h-11 items-center text-ink-muted transition-colors hover:text-ink">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex flex-col gap-3 border-t border-line pt-6 text-sm text-ink-muted sm:flex-row sm:justify-between md:col-span-2">
          <p>© 2026 Local to Lens · Demo build</p>
          <p className="max-w-md text-balance sm:text-right">
            Photography by {new Intl.ListFormat("en", { type: "conjunction" }).format(photoCredits)} on{" "}
            <a href="https://www.pexels.com" className="underline decoration-line-strong underline-offset-4 hover:text-ink">
              Pexels
            </a>
          </p>
        </div>
      </Container>
    </footer>
  );
}
