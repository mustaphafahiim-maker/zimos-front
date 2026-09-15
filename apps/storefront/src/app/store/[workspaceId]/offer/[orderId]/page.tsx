import { redirect } from "next/navigation";

/**
 * The post-purchase one-click upsell page was a simulation (the backend has no
 * "append to order" endpoint), so old links now go straight to the real
 * thank-you page.
 */
export default async function UpsellRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceId: string; orderId: string }>;
  searchParams: Promise<{ number?: string }>;
}) {
  const { workspaceId, orderId } = await params;
  const { number } = await searchParams;
  const q = number ? `?${new URLSearchParams({ number }).toString()}` : "";
  redirect(`/store/${workspaceId}/orders/${orderId}${q}`);
}
