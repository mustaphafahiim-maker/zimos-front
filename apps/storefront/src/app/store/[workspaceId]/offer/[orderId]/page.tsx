import { redirect } from "next/navigation";
import { storeHref } from "@/lib/storeHref";
import { getStoreBasePath } from "@/lib/storeRoute";

type Params = Promise<{ workspaceId: string; orderId: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * The old device-made upsell page that lived here is gone (SPEC §9.8): the
 * post-purchase offer is the store's own (Offers → post-purchase upsell, on
 * the thank-you page) and a funnel's upsell steps. Old or bookmarked /offer
 * links follow the order to its thank-you page, keeping the order number.
 */
export default async function OfferRedirect({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const [{ workspaceId, orderId }, search] = await Promise.all([params, searchParams]);
  const basePath = await getStoreBasePath(workspaceId);
  const number = typeof search.number === "string" ? search.number : null;
  const query = number ? `?${new URLSearchParams({ number }).toString()}` : "";
  redirect(storeHref(basePath, `/orders/${encodeURIComponent(orderId)}${query}`));
}
