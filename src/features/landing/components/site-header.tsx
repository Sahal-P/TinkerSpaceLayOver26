import Link from "next/link";

import { ThemeToggle } from "@/components/theme-toggle";
import { Wordmark } from "@/components/brand-mark";
import { buttonStyles } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

const links = [
  { href: "#route", label: "Demo route" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#lens", label: "Lens check" },
];

export function SiteHeader() {
  return (
    <header className="absolute inset-x-0 top-0 z-20 pt-[env(safe-area-inset-top)]">
      <Container size="xl" className="flex h-20 items-center justify-between gap-2 sm:gap-6">
        <div className="flex items-center gap-10">
          <Link href="/" aria-label="Local to Lens home" className="rounded-lg">
            <Wordmark />
          </Link>
          <nav aria-label="Primary" className="hidden md:block">
            <ul className="flex items-center gap-1">
              {links.map((link) => (
                <li key={link.href}>
                  <a href={link.href} className="rounded-lg px-3 py-3 text-sm text-ink-muted transition-colors hover:text-ink">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <div className="flex shrink-0 items-center gap-1 sm:gap-3">
          <ThemeToggle />
          <Link href="/record" aria-label="Start recording" className={buttonStyles({ size: "sm" })}>
            <span className="sm:hidden">Start</span>
            <span className="hidden sm:inline">Start recording</span>
          </Link>
        </div>
      </Container>
    </header>
  );
}
