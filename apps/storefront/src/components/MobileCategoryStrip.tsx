import type { StorefrontCollection } from "@store-builder/api-client";
import { StoreLink } from "@/components/StoreRoute";
import type { Dictionary } from "@/lib/i18n";
import { container } from "./ui";

/** A handful, not the whole catalogue — the strip is a shortcut, not a menu. */
const MAX_COLLECTIONS = 6;

/**
 * A thin, horizontally-scrollable row of the store's top collections, right
 * under the header, on phones only. It exists next to the hamburger menu
 * rather than inside it: the menu is a tap deeper and lists pages, not
 * categories, so a shopper who already knows what they want (jump straight to
 * "New in") had no one-tap way to do that on a phone until now.
 *
 * Sourced from the same public collections list the home page's fallback
 * catalogue already reads (`getStoreCollections`, `lib/storeMeta.ts`) — no
 * invented category names — and capped at a handful so the row never wraps.
 * Each chip opens the collection's own page (`/products?collection=<slug>`),
 * which works whether or not the store has published a home page. Only
 * top-level collections are listed; the page's sidebar leads further in.
 *
 * Renders nothing when the store has no collections, so it never leaves an
 * empty strip of padding under the header.
 */
export function MobileCategoryStrip({
  collections,
  t,
}: {
  collections: StorefrontCollection[];
  t: Dictionary;
}) {
  const items = collections.filter((c) => !c.parentId).slice(0, MAX_COLLECTIONS);
  if (items.length === 0) return null;

  return (
    <nav aria-label={t.home.collections} className="border-b border-line bg-paper-raised sm:hidden">
      <ul className={`${container} flex gap-2 overflow-x-auto py-2`}>
        {items.map((c) => (
          <li key={c.id} className="shrink-0">
            <StoreLink
              href={`/products?collection=${encodeURIComponent(c.slug)}`}
              className="zt-chip inline-flex min-h-11 items-center rounded-full border border-line bg-paper px-3 text-xs font-medium text-ink-soft transition-colors hover:border-primary hover:text-primary"
            >
              {c.name}
            </StoreLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
