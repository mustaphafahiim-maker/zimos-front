import type { Metadata } from "next";
import { AffiliatePortal } from "@/components/AffiliatePortal";

// A private area for the store's marketers: never indexed.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AffiliatePortalPage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await params;
  return <AffiliatePortal workspaceId={workspaceId} />;
}
