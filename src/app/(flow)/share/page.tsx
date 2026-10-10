import type { Metadata } from "next";

import { ShareScreen } from "@/features/journey/components/share/share-screen";

export const metadata: Metadata = {
  title: "Share",
  description: "Publish the guide and share it with a link or QR code.",
};

export default function Page() {
  return <ShareScreen />;
}
