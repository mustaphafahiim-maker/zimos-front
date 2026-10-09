/**
 * The GTM container without the store's own Google tags (handoff item 303;
 * backend src/modules/marketing/gtmContainer.js): a GA4 / Google Ads id that
 * already runs as a Zimos pixel is left out of the file, so nothing counts
 * twice, and named in the `X-Zimos-Skipped-Ids` response header ("none"
 * otherwise).
 *
 * The header is readable same-origin (the dashboard's /api proxy); cross-origin
 * the API does not list it in Access-Control-Expose-Headers, so `skipped` is
 * then null and the caller falls back on the store's own active Google pixels.
 */
import type { ApiClient } from "../client";
import type { GtmContainerParams } from "./gtmContainer";

export interface GtmContainerFile {
  blob: Blob;
  /** The ids left out; [] for "none"; null when the header could not be read. */
  skipped: string[] | null;
}

/** ApiClient.rawFetch is private to the class; reached through one typed cast, like gtmContainer.ts. */
function rawFetch(client: ApiClient, path: string, init: RequestInit): Promise<Response> {
  return (client as unknown as { rawFetch(path: string, init: RequestInit): Promise<Response> }).rawFetch(path, init);
}

export async function trackingPixelsGtmContainerFile(
  client: ApiClient,
  workspaceId: string,
  params: GtmContainerParams = {}
): Promise<GtmContainerFile> {
  const query = new URLSearchParams({ download: "true" });
  for (const key of ["ga4", "ads", "purchaseLabel", "leadLabel"] as const) {
    const value = params[key]?.trim();
    if (value) query.set(key, value);
  }
  const res = await rawFetch(client, `/workspaces/${workspaceId}/tracking-pixels/gtm/container?${query.toString()}`, {
    headers: { Accept: "application/json" },
  });
  const header = res.headers.get("X-Zimos-Skipped-Ids");
  const skipped =
    header === null
      ? null
      : header.trim().toLowerCase() === "none"
        ? []
        : header
            .split(",")
            .map((id) => id.trim())
            .filter(Boolean);
  return { blob: await res.blob(), skipped };
}
