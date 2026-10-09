"use client";

import { card, container, skeleton } from "@/components/ui";
import { useStore } from "@/lib/StoreContext";

/** A label and its box, the size of one field of the order form. */
function FieldGhost({ wide = false }: { wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <span className={`${skeleton} mb-1.5 block h-4 w-28`} />
      <span className={`${skeleton} block h-11 w-full`} />
    </div>
  );
}

/**
 * What a tap on "checkout" shows while the route is on its way: the page's
 * own frame — the title, the progress line, the summary strip (a phone) or
 * column (`lg`), the order form's fields, the payment block — so the page
 * that replaces it lands in the same places. Keep it in step with page.tsx.
 *
 * A client component only for the store's dictionary (the title, and the
 * label a screen reader hears), which the store layout hands down.
 */
export default function CheckoutLoading() {
  const { t } = useStore();
  return (
    <main className={`${container} flex-1 py-6 sm:py-10`}>
      <span className={`${skeleton} block h-11 w-32 bg-transparent`} />
      <h1 className="mt-2 font-display text-2xl font-bold text-ink sm:text-3xl">{t.checkout.title}</h1>
      <div className="mt-5 flex max-w-xl items-center gap-3">
        {[0, 1, 2].map((i) => (
          <span key={i} className="flex flex-1 items-center gap-2">
            <span className={`${skeleton} h-8 w-8 shrink-0 rounded-full`} />
            <span className={`${skeleton} h-3 flex-1`} />
          </span>
        ))}
      </div>

      <div
        className="mt-6 grid gap-6 lg:mt-8 lg:grid-cols-[1fr_24rem] lg:gap-8"
        role="status"
        aria-busy="true"
        aria-label={t.common.loading}
      >
        <div className="order-2 space-y-6 lg:order-none">
          <div className={`${card} p-5 sm:p-6`}>
            <span className={`${skeleton} block h-5 w-36`} />
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <FieldGhost wide />
              <FieldGhost wide />
              <FieldGhost />
              <FieldGhost />
              <FieldGhost wide />
            </div>
          </div>
          <div className={`${card} p-5 sm:p-6`}>
            <span className={`${skeleton} block h-5 w-32`} />
            <span className={`${skeleton} mt-4 block h-14 w-full`} />
          </div>
        </div>

        <div className="order-1 lg:order-none">
          {/* The strip on a phone; the summary card from `lg`. */}
          <div className={`${card} flex min-h-16 items-center gap-3 px-4 py-3 lg:hidden`}>
            <span className={`${skeleton} size-10 shrink-0`} />
            <span className="flex-1 space-y-2">
              <span className={`${skeleton} block h-4 w-24`} />
              <span className={`${skeleton} block h-3 w-16`} />
            </span>
            <span className={`${skeleton} h-5 w-16`} />
          </div>
          <div className={`${card} hidden space-y-3 p-5 lg:block`}>
            <span className={`${skeleton} block h-5 w-1/2`} />
            <span className={`${skeleton} block h-4 w-full`} />
            <span className={`${skeleton} block h-4 w-2/3`} />
            <span className={`${skeleton} mt-4 block h-12 w-full`} />
          </div>
        </div>
      </div>
    </main>
  );
}
