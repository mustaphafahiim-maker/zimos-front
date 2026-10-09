"use client";

import { card, container, skeleton } from "@/components/ui";
import { useStore } from "@/lib/StoreContext";

/**
 * What a tap on the cart shows while the route is on its way: the cart page's
 * own frame — its title, two lines, the summary column — so the page that
 * replaces it lands in the same places. The page draws this same shape itself
 * while the cart is still being read (page.tsx); keep the two alike.
 *
 * A client component only for the store's dictionary (the title and the
 * label a screen reader hears), which the store layout hands down.
 */
export default function CartLoading() {
  const { t } = useStore();
  return (
    <main className={`${container} flex-1 py-8 sm:py-10`}>
      <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">{t.cart.title}</h1>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_22rem]" role="status" aria-busy="true" aria-label={t.cart.loading}>
        <ul className={`${card} divide-y divide-line`}>
          {[0, 1].map((i) => (
            <li key={i} className="flex gap-4 p-4 sm:p-5">
              <span className={`${skeleton} h-20 w-20 shrink-0`} />
              <span className="flex-1 space-y-2 pt-1">
                <span className={`${skeleton} block h-4 w-2/3`} />
                <span className={`${skeleton} block h-3 w-1/4`} />
                <span className={`${skeleton} mt-3 block h-11 w-32`} />
              </span>
            </li>
          ))}
        </ul>
        <div className={`${card} space-y-3 p-5`}>
          <span className={`${skeleton} block h-5 w-1/2`} />
          <span className={`${skeleton} block h-4 w-full`} />
          <span className={`${skeleton} block h-12 w-full`} />
        </div>
      </div>
    </main>
  );
}
