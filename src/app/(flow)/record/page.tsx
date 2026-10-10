import type { Metadata } from "next";

import { RecordScreen } from "@/features/journey/components/record/record-screen";

export const metadata: Metadata = {
  title: "Record",
  description: "Record a local's directions in any language.",
};

export default function Page() {
  return <RecordScreen />;
}
