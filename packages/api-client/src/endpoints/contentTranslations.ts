import type { ApiClient } from "../client";
import type { StoreLocale } from "./storeDesign";

/** The live pages and funnels whose text is translated (translations/contentTranslations.js). */
export type ContentEntity = "page" | "funnel";

export interface ContentTranslationItem {
  entityType: ContentEntity;
  entityId: string;
  /** The page's title or the funnel's name; `sub` is the page's path. */
  label: string;
  sub: string | null;
  /** Each text once, in reading order. `key` is a hash of the original: an edited text is untranslated again. */
  texts: Array<{ key: string; source: string; translation: string }>;
}

export async function contentTranslationsList(
  client: ApiClient,
  workspaceId: string,
  entityType: ContentEntity,
  locale: StoreLocale
): Promise<ContentTranslationItem[]> {
  const query = new URLSearchParams({ entityType, locale });
  const { items } = await client.request<{ items: ContentTranslationItem[] }>(`/workspaces/${workspaceId}/translations/content?${query}`);
  return items;
}

/** An empty text goes back to the original. */
export async function contentTranslationsSave(
  client: ApiClient,
  workspaceId: string,
  payload: { entityType: ContentEntity; entityId: string; locale: StoreLocale; texts: Record<string, string> }
): Promise<ContentTranslationItem | null> {
  const { item } = await client.request<{ item: ContentTranslationItem | null }>(`/workspaces/${workspaceId}/translations/content`, {
    method: "PUT",
    body: payload,
  });
  return item;
}
