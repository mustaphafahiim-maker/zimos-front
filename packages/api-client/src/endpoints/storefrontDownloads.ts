/**
 * The thank-you page's download links (backend: digital/digitalRoutes.js,
 * GET /store/:ws/downloads/order/:orderId, public). The order's payment token
 * (x-payment-token, returned by the online checkout) is the credential; the
 * list is empty until the payment is captured.
 */
import type { ApiClient } from "../client";
import type { TrackDownload } from "./digital";

export async function storefrontOrderDownloads(
  client: ApiClient,
  workspaceRef: string,
  orderId: string,
  paymentToken: string,
): Promise<TrackDownload[]> {
  const { downloads } = await client.request<{ downloads: TrackDownload[] }>(
    `/store/${encodeURIComponent(workspaceRef)}/downloads/order/${encodeURIComponent(orderId)}`,
    { auth: false, headers: { "x-payment-token": paymentToken } },
  );
  return downloads;
}
