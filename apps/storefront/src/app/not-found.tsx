import { NotFoundContent } from "@/components/NotFoundContent";

/**
 * The 404 for everything the store boundary can't catch.
 *
 * Two kinds of request land here. A URL that matches no route at all — `/store`
 * with nothing after it, a stray path on a host that names no store. And,
 * less obviously, an unknown store: the store layout itself calls `notFound()`
 * for a workspace the API doesn't know, and a boundary sits *inside* the layout
 * of its own segment, so when that layout aborts its boundary aborts with it
 * and the 404 surfaces here instead.
 *
 * Which means there is no store to go back to in either case — the link is the
 * site root, not a store home.
 */
export default function NotFound() {
  return <NotFoundContent homeHref="/" homeLabel="Back to home" />;
}
