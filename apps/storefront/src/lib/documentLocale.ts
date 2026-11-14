import { headers } from "next/headers";
import { dirFor, type Locale } from "./i18n";
import { getStoreMeta } from "./storeMeta";
import { getStoreLocale } from "./storeLocale";

/**
 * Set by the proxy on every store request — the store's slug, or the
 * workspace id from an internal /store/<id>/… path — so the root layout can
 * put the store's language on <html> in the server's HTML (SPEC §8.10:
 * search engines read `lang`/`dir` from the first response, not after
 * hydration). Unlike x-store-slug, it says nothing about the URL shape.
 */
export const STORE_REF_HEADER = "x-store-ref";

const REF = /^[A-Za-z0-9-]{1,100}$/;

/** `lang`/`dir` for <html>: the shopper's language in this store, else the neutral default. */
export async function documentLocale(): Promise<{ lang: Locale | "en"; dir: "rtl" | "ltr" }> {
  try {
    const ref = (await headers()).get(STORE_REF_HEADER);
    if (!ref || !REF.test(ref)) return { lang: "en", dir: "ltr" };
    const store = await getStoreMeta(ref);
    if (!store) return { lang: "en", dir: "ltr" };
    const locale = await getStoreLocale(store);
    return { lang: locale, dir: dirFor(locale) };
  } catch {
    return { lang: "en", dir: "ltr" };
  }
}
