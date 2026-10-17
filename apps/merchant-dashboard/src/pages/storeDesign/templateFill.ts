import {
  contentTranslationsList,
  contentTranslationsSave,
  translationsList,
  translationsSave,
  type ApiClient,
  type ContentEntity,
  type StoreLocale,
  type TranslatableEntity,
} from "@store-builder/api-client";
import { englishFor, type XsDictionary } from "../website/templates/xs/xsDictionary";

/** At most this many texts in one save (the API's limit for a page's texts). */
const BATCH = 500;

const CONTENT: ContentEntity[] = ["page", "shell"];
const RECORDS: TranslatableEntity[] = ["product", "collection"];

/**
 * Fills the store's empty translations in `locale` from the template's
 * dictionary (templates/xs/xsDictionary.ts): the live pages' texts, the header
 * and footer, and the products' and collections' names and descriptions. A
 * translation already there is never written over; a text the dictionary
 * doesn't know is counted, not touched. Funnels are not the template's.
 */
export async function fillFromTemplate({
  client,
  workspaceId,
  locale,
  dictionary,
  look,
}: {
  client: ApiClient;
  workspaceId: string;
  locale: StoreLocale;
  dictionary: Pick<XsDictionary, "arToEn" | "byLook">;
  look: string | null;
}): Promise<{ filled: number; left: number }> {
  let filled = 0;
  let left = 0;
  const english = (text: string) => englishFor(dictionary, text, look);

  for (const entityType of CONTENT) {
    for (const item of await contentTranslationsList(client, workspaceId, entityType, locale)) {
      const texts: Record<string, string> = {};
      for (const text of item.texts) {
        if (text.translation) continue;
        const found = english(text.source);
        if (found) texts[text.key] = found;
        else left += 1;
      }
      const keys = Object.keys(texts);
      for (let at = 0; at < keys.length; at += BATCH) {
        const batch = Object.fromEntries(keys.slice(at, at + BATCH).map((key) => [key, texts[key]]));
        await contentTranslationsSave(client, workspaceId, { entityType, entityId: item.entityId, locale, texts: batch });
      }
      filled += keys.length;
    }
  }

  for (const entityType of RECORDS) {
    for (const item of await translationsList(client, workspaceId, entityType, locale)) {
      const fields: Partial<Record<"name" | "description", string>> = {};
      for (const field of ["name", "description"] as const) {
        const source = item.source[field];
        if (!source?.trim() || item.translation[field]) continue;
        const found = english(source);
        if (found) fields[field] = found;
        else left += 1;
      }
      if (Object.keys(fields).length === 0) continue;
      await translationsSave(client, workspaceId, { entityType, entityId: item.entityId, locale, fields });
      filled += Object.keys(fields).length;
    }
  }
  return { filled, left };
}
