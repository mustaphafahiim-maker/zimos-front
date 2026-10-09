import { cookies } from "next/headers";
import {
  storefrontSearchListing,
  type ApiClient,
  type StorefrontListingParams,
  type StorefrontSearchListing,
} from "@store-builder/api-client";
import { SEARCH_VISITOR_COOKIE, isSearchVisitorId } from "./searchVisitor";

/**
 * The products listing for a server page (frontend-handoff 211). A search is
 * sent with the shopper's visitor id, when the search box left it in its
 * cookie (lib/searchVisitor), and comes back with `searchId` — and `servedAs`
 * when a synonym's results were shown. A listing without a search is the
 * plain call.
 */
export async function searchListing(
  client: ApiClient,
  workspaceId: string,
  params: StorefrontListingParams
): Promise<StorefrontSearchListing> {
  const visitor = params.search ? (await cookies()).get(SEARCH_VISITOR_COOKIE)?.value : undefined;
  return storefrontSearchListing(client, workspaceId, params, isSearchVisitorId(visitor) ? visitor : null);
}
