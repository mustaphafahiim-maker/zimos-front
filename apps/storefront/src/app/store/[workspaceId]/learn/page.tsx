import type { Metadata } from "next";
import { LearnHome } from "@/components/LearnPortal";

// The student's own area: never indexed.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function LearnPage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await params;
  return <LearnHome workspaceId={workspaceId} />;
}
