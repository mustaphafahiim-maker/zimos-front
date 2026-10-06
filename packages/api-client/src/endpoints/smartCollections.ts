/**
 * Smart collections (backend: src/modules/catalog/smartCollections.js,
 * frontend-handoff 162). A collection whose `rules` is set fills itself:
 *
 *   { type: "tags", match: "any" | "all", tags: [...] }   products carrying any / all of the tags
 *   { type: "all_products" }                               every product of the store
 *   null                                                   a manual collection (links stay, edited by hand)
 *
 * Rules travel on the existing collection create / update calls
 * (products.manage); saving them re-fills the collection at once. A bad shape
 * is 422 VALIDATION_ERROR (field "rules"). Adding or removing a product by
 * hand on a smart collection is 409 SMART_COLLECTION; reordering still works.
 *
 *   POST /workspaces/:ws/smart-collections/all-products   { name? } -> 201 created / 200 existing
 *   POST /workspaces/:ws/smart-collections/:id/sync       -> { id, added, removed }  (409 NOT_SMART_COLLECTION)
 */
import type { ApiClient } from "../client";
import type { CollectionSummary, CreateCollectionPayload, UpdateCollectionPayload } from "../types";

export type SmartCollectionMatch = "any" | "all";

export type SmartCollectionRules =
  | { type: "tags"; match: SmartCollectionMatch; tags: string[] }
  | { type: "all_products" };

/** The server's limits on a tag rule. */
export const SMART_COLLECTION_MAX_TAGS = 20;
export const SMART_COLLECTION_TAG_MAX_LENGTH = 100;

/** The collection's rules in their typed shape, or null for a manual collection (or a shape this client doesn't know). */
export function smartCollectionRulesOf(collection: Pick<CollectionSummary, "rules"> | null | undefined): SmartCollectionRules | null {
  const rules = collection?.rules;
  if (!rules || typeof rules !== "object") return null;
  if (rules.type === "all_products") return { type: "all_products" };
  if (rules.type === "tags" && Array.isArray(rules.tags)) {
    const tags = rules.tags.filter((tag): tag is string => typeof tag === "string" && tag.trim().length > 0);
    return { type: "tags", match: rules.match === "all" ? "all" : "any", tags };
  }
  return null;
}

/** True when the collection fills itself from rules (no hand-added or hand-removed products). */
export function isSmartCollection(collection: Pick<CollectionSummary, "rules"> | null | undefined): boolean {
  const type = collection?.rules && typeof collection.rules === "object" ? collection.rules.type : undefined;
  return typeof type === "string" && type.length > 0;
}

/** The collection payload with typed rules. */
export type SmartCollectionCreatePayload = Omit<CreateCollectionPayload, "rules"> & { rules?: SmartCollectionRules | null };
export type SmartCollectionUpdatePayload = Omit<UpdateCollectionPayload, "rules"> & { rules?: SmartCollectionRules | null };

/** Creates a collection, sending its rules (null or absent: manual). */
export function smartCollectionsCreate(client: ApiClient, workspaceId: string, payload: SmartCollectionCreatePayload) {
  return client.createCollection(workspaceId, payload);
}

/** Updates a collection; `rules: null` turns a smart one back into a manual one. */
export function smartCollectionsUpdate(
  client: ApiClient,
  workspaceId: string,
  collectionId: string,
  payload: SmartCollectionUpdatePayload
) {
  return client.updateCollection(workspaceId, collectionId, payload);
}

/** Creates the store's "All products" collection once (slug "all"); returns the existing one otherwise. */
export function smartCollectionsEnsureAllProducts(
  client: ApiClient,
  workspaceId: string,
  name?: string
): Promise<{ collection: CollectionSummary; created: boolean }> {
  return client.request<{ collection: CollectionSummary; created: boolean }>(
    `/workspaces/${workspaceId}/smart-collections/all-products`,
    { method: "POST", body: name ? { name } : {} }
  );
}

/** Re-fills one smart collection from its rules by hand. */
export function smartCollectionsSync(
  client: ApiClient,
  workspaceId: string,
  collectionId: string
): Promise<{ id: string; added: number; removed: number }> {
  return client.request<{ id: string; added: number; removed: number }>(
    `/workspaces/${workspaceId}/smart-collections/${collectionId}/sync`,
    { method: "POST", body: {} }
  );
}

/**
 * Tags already on the store's products, most used first — suggestions for a
 * tag rule. There is no product-tags endpoint, so they are read from the
 * newest products (one page, up to 200).
 */
export async function smartCollectionsKnownTags(client: ApiClient, workspaceId: string): Promise<string[]> {
  const { products } = await client.listProducts(workspaceId, { limit: 200 });
  const counts = new Map<string, { tag: string; n: number }>();
  for (const product of products) {
    for (const raw of product.tags ?? []) {
      const tag = String(raw).trim();
      if (!tag) continue;
      const key = tag.toLowerCase();
      const seen = counts.get(key);
      if (seen) seen.n += 1;
      else counts.set(key, { tag, n: 1 });
    }
  }
  return [...counts.values()].sort((a, b) => b.n - a.n || a.tag.localeCompare(b.tag)).map((entry) => entry.tag);
}
