import { Suspense } from "react";
import type { Metadata } from "next";
import { TrackOrder, TrackOrderSkeleton } from "@/components/TrackOrder";
import { getDictionary } from "@/lib/i18n";
import { getStoreLocale } from "@/lib/storeLocale";
import { getStoreMeta } from "@/lib/storeMeta";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}): Promise<Metadata> {
  const { workspaceId } = await params;
  const store = await getStoreMeta(workspaceId);
  const t = getDictionary(await getStoreLocale(store));
  return { title: t.track.title, robots: { index: false } };
}

export default function TrackOrderPage() {
  return (
    // The lookup reads the link's query (…?t=, …?number=): a boundary of its own, with the page's outline behind it.
    <Suspense fallback={<TrackOrderSkeleton />}>
      <TrackOrder />
    </Suspense>
  );
}
