"use client";

import { card, container, skeleton } from "@/components/ui";
import { useStore } from "@/lib/StoreContext";

/**
 * One payment state's outline — the mark, a title, a line, the button — for
 * the moment the order's payment is still being read. Every state the pay
 * page then shows (waiting, paid, failed…) has this shape.
 */
export function PayStateOutline() {
  return (
    <div className="flex flex-col items-center">
      {/* Not the `skeleton` recipe: its own corners would win over a circle's. */}
      <span className="block h-14 w-14 animate-pulse rounded-full bg-line/60 motion-reduce:animate-none" />
      <span className={`${skeleton} mt-3 block h-6 w-52 max-w-full`} />
      <span className={`${skeleton} mt-2 block h-4 w-64 max-w-full`} />
      <span className={`${skeleton} mt-5 block h-12 w-full`} />
    </div>
  );
}

/**
 * The pay page before it is there (pay/[orderId]/loading.tsx, and the page's
 * own Suspense fallback): its title, the order's line and one state's outline.
 */
export function PaySkeleton() {
  const { t } = useStore();
  return (
    <main className={`${container} flex-1 py-8 sm:py-14`}>
      <div className="mx-auto max-w-xl">
        <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">{t.payment.title}</h1>
        <span aria-hidden className={`${skeleton} mt-1 block h-5 w-48 max-w-full`} />
        <section className={`${card} mt-6 p-5 sm:p-6`} role="status" aria-busy="true" aria-label={t.payment.checking}>
          <PayStateOutline />
        </section>
      </div>
    </main>
  );
}
