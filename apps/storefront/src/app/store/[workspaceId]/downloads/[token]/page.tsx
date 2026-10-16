import type { Metadata } from "next";
import { DigitalDownload } from "@/components/DigitalDownload";

// A private link: never indexed, never cached.
export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function DownloadPage({ params }: { params: Promise<{ workspaceId: string; token: string }> }) {
  const { workspaceId, token } = await params;
  return <DigitalDownload workspaceId={workspaceId} token={token} />;
}
