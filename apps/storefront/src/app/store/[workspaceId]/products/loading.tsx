"use client";

import { useSelectedLayoutSegment } from "next/navigation";
import { container, skeleton } from "@/components/ui";
import { useStore } from "@/lib/StoreContext";

/**
 * The outline of the two pages under `/products` while one of them is on its
 * way: the list — its title, the sort control, a grid of product cards with
 * the cards' own square photos — and, since this is also the nearest outline
 * to a single product's page, that page's frame: the square photo beside a
 * title, a price, the options and the button. Which one is asked of the
 * router; a page with its own loading file beside it uses that instead.
 *
 * Filtering, sorting and paging keep the list on screen while the new one
 * loads: they change the address's query, not the page, and Next shows an
 * outline only when the page itself changes.
 *
 * The boxes are the page's own sizes, so what replaces them lands in the same
 * places; they hold still under reduced motion. The shapes repeat the ones in
 * ../loading.tsx, which stands in until this file itself has arrived — keep
 * the two alike.
 */

const box = `${skeleton} block`;
const pulse = "animate-pulse bg-line/60 motion-reduce:animate-none";

/** A product card's box: the square photo, a name, a price, the button. */
function CardBox() {
  return (
    <div className="zt-card overflow-hidden rounded-2xl border border-line bg-paper-raised">
      <div className={`aspect-square ${pulse}`} />
      <div className="p-4">
        <span className={`${box} h-4 w-4/5`} />
        <span className={`${box} mt-3 h-5 w-1/3`} />
        <span className={`${box} mt-4 h-11 w-full`} />
      </div>
    </div>
  );
}

function ListingShape() {
  return (
    <div className={`${container} py-8 sm:py-10`}>
      <span className={`${box} my-3.5 h-4 w-40`} />
      <div className="mt-4 flex items-end justify-between gap-4">
        <div className="min-w-0 flex-1">
          <span className={`${box} h-8 w-48 max-w-full`} />
          <span className={`${box} mt-2 h-4 w-24`} />
        </div>
        <span className={`${box} h-11 w-32 shrink-0`} />
      </div>
      <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <CardBox key={i} />
        ))}
      </div>
    </div>
  );
}

function ProductShape() {
  return (
    <div className={`${container} py-6 sm:py-8`}>
      <span className={`${box} my-3.5 h-4 w-24`} />
      <div className="mt-2 grid gap-8 md:grid-cols-2 lg:gap-12">
        <div className={`aspect-square rounded-2xl ${pulse}`} />
        <div>
          <span className={`${box} h-8 w-4/5`} />
          <span className={`${box} mt-4 h-7 w-1/3`} />
          <span className={`${box} mt-6 h-4 w-1/4`} />
          <div className="mt-3 flex gap-2">
            <span className={`${box} h-11 w-20`} />
            <span className={`${box} h-11 w-20`} />
            <span className={`${box} h-11 w-20`} />
          </div>
          <span className={`${box} mt-6 h-12 w-full`} />
          <span className={`${box} mt-3 h-4 w-2/3`} />
        </div>
      </div>
    </div>
  );
}

export default function ProductsLoading() {
  const { t } = useStore();
  // null for the list itself; the product's slug when a single product is on its way.
  const product = useSelectedLayoutSegment();
  return (
    <main className="min-h-screen flex-1">
      {/* The page's place in the document stays a <main>; the outline inside it is what is announced. */}
      <div role="status" aria-busy="true" aria-label={t.common.loading}>
        {product === null ? <ListingShape /> : <ProductShape />}
      </div>
    </main>
  );
}
