"use client";

import { useSelectedLayoutSegments } from "next/navigation";
import { container, skeleton } from "@/components/ui";
import { useStore } from "@/lib/StoreContext";

/**
 * What a shopper sees between tapping a link and the page arriving — and on a
 * first visit, between the store's header and the page under it: the page's
 * own outline instead of the old page frozen, or of nothing. The header and
 * footer are the layout's and are already there; this fills the space between
 * them, tall enough that the footer stays off screen until the page lands.
 *
 * Next shows this for every page under the store that has no outline of its
 * own, so it asks which page is on its way and draws that one's shape:
 *
 *   the store's front page   a wide block (the hero) and a grid of product cards
 *   the products list        its title and a grid (when products/loading.tsx,
 *                            the nearer file, has not arrived yet)
 *   a product                the square photo beside a title, a price, a button
 *   a funnel step            a narrow column — no store header to sit under
 *   anything else            a title and a few lines (checkout, tracking, a
 *                            page the merchant wrote, the blog…)
 *
 * The website editor's preview (`preview/<token>`) is the exception: it gets a
 * plain cover over the whole frame instead of an outline. That page puts the
 * merchant's unsaved look on the store before its first paint; the header
 * above is still in the saved one until it does, and the cover keeps the
 * editor from flashing the saved look on every preview.
 *
 * A client component for the route's segments and for the store's dictionary
 * (the label a screen reader hears). Every box holds still under reduced motion.
 *
 * One thing this file changes that is not about looks: a page that streams in
 * behind an outline has already answered 200 by the time it finds out a
 * product is gone or an address has moved, so its 404 and its redirects reach
 * the browser inside the page (Next marks such a 404 `noindex`) instead of as
 * the response's status. See the note in the phase report.
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

function CardGrid({ count, className }: { count: number; className: string }) {
  return (
    <div className={className}>
      {Array.from({ length: count }, (_, i) => (
        <CardBox key={i} />
      ))}
    </div>
  );
}

function HomeShape() {
  return (
    <>
      <div className={`h-64 w-full sm:h-96 ${pulse}`} />
      <div className={`${container} py-8`}>
        <span className={`${box} h-7 w-40`} />
        <CardGrid count={8} className="mt-6 grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4" />
      </div>
    </>
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
      <CardGrid count={6} className="mt-8 grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3" />
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

function PageShape({ narrow = false }: { narrow?: boolean }) {
  return (
    <div className={narrow ? "mx-auto w-full max-w-xl px-4 py-10" : `${container} py-8 sm:py-10`}>
      <span className={`${box} h-8 w-1/2`} />
      <span className={`${box} mt-6 h-4 w-full`} />
      <span className={`${box} mt-3 h-4 w-11/12`} />
      <span className={`${box} mt-3 h-4 w-2/3`} />
      <span className={`${box} mt-8 h-40 w-full`} />
      <span className={`${box} mt-4 h-12 w-full sm:w-64`} />
    </div>
  );
}

export default function StoreLoading() {
  const { t } = useStore();
  // The pages under the store layout: [] for the front page, ["products"], ["products", "<slug>"], ["f", …], ["checkout"]…
  const [first, second] = useSelectedLayoutSegments();
  if (first === "preview") return <div aria-hidden className="fixed inset-0 z-[60] bg-paper" />;
  return (
    <main className="min-h-screen flex-1">
      {/* The page's place in the document stays a <main>; the outline inside it is what is announced. */}
      <div role="status" aria-busy="true" aria-label={t.common.loading}>
        {first === undefined ? (
          <HomeShape />
        ) : first === "products" ? (
          second === undefined ? (
            <ListingShape />
          ) : (
            <ProductShape />
          )
        ) : (
          <PageShape narrow={first === "f"} />
        )}
      </div>
    </main>
  );
}
