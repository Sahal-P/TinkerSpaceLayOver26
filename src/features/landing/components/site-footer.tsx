import { Container } from "@/components/ui/container";
import { siteConfig } from "@/config/site";

export function SiteFooter() {
  return (
    <footer className="border-t border-line pb-[max(2rem,env(safe-area-inset-bottom))] pt-8">
      <Container className="flex flex-col gap-1 text-sm text-ink-muted sm:flex-row sm:justify-between">
        <p className="font-display font-semibold text-ink">{siteConfig.name}</p>
        <p>For travelers who would rather look up than type.</p>
      </Container>
    </footer>
  );
}
