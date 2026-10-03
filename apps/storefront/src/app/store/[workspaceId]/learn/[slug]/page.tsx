import type { Metadata } from "next";
import { LearnCourse } from "@/components/LearnPortal";

// What a visitor sees depends on whether they are enrolled, so it is never indexed or cached.
export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function LearnCoursePage({ params }: { params: Promise<{ workspaceId: string; slug: string }> }) {
  const { workspaceId, slug } = await params;
  return <LearnCourse workspaceId={workspaceId} slug={slug} />;
}
