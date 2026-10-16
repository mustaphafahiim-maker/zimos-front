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

/** "Translate what's missing with AI" (translations/aiFill.js): AI jobs of up to 20 texts each, at most five per call. */
export async function translationsAiStart(
  client: ApiClient,
  workspaceId: string,
  payload: { entityType: ContentEntity | "product" | "collection"; locale: StoreLocale }
): Promise<{ jobs: string[]; texts: number; remaining: number }> {
  return client.request(`/workspaces/${workspaceId}/translations/ai`, { method: "POST", body: payload });
}

/** Saves what the finished jobs answered (never over a translation saved meanwhile); call until `pending` is empty. */
export async function translationsAiApply(
  client: ApiClient,
  workspaceId: string,
  jobIds: string[]
): Promise<{ saved: number; pending: string[]; failed: string[] }> {
  return client.request(`/workspaces/${workspaceId}/translations/ai/apply`, { method: "POST", body: { jobIds } });
}
