import type { ReactNode } from "react";

import { FlowHeader } from "@/features/journey/components/flow/flow-header";
import { JourneyProvider } from "@/features/journey/journey-store";

export default function FlowLayout({ children }: { children: ReactNode }) {
  return (
    <JourneyProvider>
      <div className="flex min-h-dvh flex-col">
        <FlowHeader />
        <main id="main" tabIndex={-1} className="flex flex-1 flex-col outline-none">
          {children}
        </main>
      </div>
    </JourneyProvider>
  );
}
