import { cache } from "react";
import { storefrontBranches, type StorefrontBranches } from "@store-builder/api-client";
import { createServerStorefrontApiClient } from "./serverApiClient";

/**
 * The store's public branches for this request (frontend-handoff 233), read
 * once per render: the store layout asks whether to put «فروعنا» in the
 * footer, and the branches page draws the same answer. Null while the store
 * locator is off — and for a locked or unavailable store or an API out of
 * reach, where there is nothing to link to either.
 */
export const getStoreBranches = cache(async (workspaceId: string): Promise<StorefrontBranches | null> => {
  try {
    const client = await createServerStorefrontApiClient();
    return await storefrontBranches(client, workspaceId);
  } catch {
    return null;
  }
});
