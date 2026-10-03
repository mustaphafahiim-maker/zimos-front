import type { Metadata } from "next";
import { SubscriptionPortal } from "@/components/SubscriptionPortal";

// A private link: never indexed, never cached.
export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function SubscriptionPortalPage({ params }: { params: Promise<{ workspaceId: string; token: string }> }) {
  const { workspaceId, token } = await params;
  return <SubscriptionPortal workspaceId={workspaceId} token={token} />;
}
