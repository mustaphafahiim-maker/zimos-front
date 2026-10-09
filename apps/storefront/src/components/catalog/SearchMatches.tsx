import type { ReactNode } from "react";
import { storefrontSearchMeta, type StorefrontListing } from "@store-builder/api-client";
import { pickText, type Locale } from "@/lib/i18n";
import { SearchClicks } from "./SearchClicks";

/**
 * The two things a search's results page adds for frontend-handoff 211, kept
 * out of the page itself:
 *
 *  - <SearchMatches> wraps the grid of matches so a result the shopper opens
 *    is reported (components/catalog/SearchClicks.tsx). Only each match's id
 *    and slug cross to the browser, not the listing.
 *  - <ServedAsNote> says «نتايج عن "t-shirt"» when the words found nothing and
 *    the store's synonym was searched instead.
 */

const TEXT = {
  en: { showing: "Showing results for" },
  ar: { showing: "نتايج عن" },
};

export function SearchMatches({ listing, query, children }: { listing: StorefrontListing; query: string; children: ReactNode }) {
  const { searchId } = storefrontSearchMeta(listing);
  return (
    <SearchClicks searchId={searchId} query={query} products={listing.products.map((p) => ({ id: p.id, slug: p.slug }))}>
      {children}
    </SearchClicks>
  );
}

export function ServedAsNote({ listing, locale }: { listing: StorefrontListing; locale: Locale }) {
  const { servedAs } = storefrontSearchMeta(listing);
  if (!servedAs) return null;
  return (
    <p role="status" className="-mt-2 mb-4 text-sm font-medium text-ink-soft">
      {pickText(TEXT, locale).showing} &quot;<bdi className="text-ink">{servedAs}</bdi>&quot;
    </p>
  );
}
