"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { TrackOrderSkeleton } from "@/components/TrackOrder";

/** The outline of what the link is about to open: an order's status card, or the lookup form. */
function Shaped() {
  const search = useSearchParams();
  return <TrackOrderSkeleton order={search.has("t") || search.has("order")} />;
}

/**
 * The tracking page while its route is on its way. A link that opens an order
 * by itself (…?t=, or the thank-you page's …?order=) gets the status card's
 * outline; any other gets the form's. A client component only to read the
 * link's query; the boundary keeps that read from holding anything above it.
 */
export default function TrackLoading() {
  return (
    <Suspense fallback={<TrackOrderSkeleton />}>
      <Shaped />
    </Suspense>
  );
}
