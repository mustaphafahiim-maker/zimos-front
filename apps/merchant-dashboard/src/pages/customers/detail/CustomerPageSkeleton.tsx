import { CardSkeleton, SkeletonBar } from "@/components/DataState";

/**
 * The customer page while its customer loads: the hero — who, the number,
 * four facts — then the orders and the first folded rows where they will
 * stand, in one column on a phone and two from lg up. Same paddings and
 * heights as the real thing, so nothing jumps when the customer arrives.
 * `DataState` wraps it in the "loading" status.
 */
export function CustomerPageSkeleton() {
  return (
    <div className="flex flex-col gap-[var(--bento-gap)]">
      <div data-slot="skeleton-card" className="zimos-customer-hero rounded-[1.75rem] bg-paper-raised shadow-[var(--shadow-card)] ring-1 ring-line">
        <div className="flex flex-col gap-4 p-4 sm:p-5 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <SkeletonBar className="size-14 shrink-0" />
            <div className="min-w-0 flex-1">
              <SkeletonBar className="h-5 w-40 max-w-full" />
              <SkeletonBar className="mt-3 w-28" />
            </div>
          </div>
          <div className="hidden gap-2 md:flex">
            <SkeletonBar className="h-10 w-24" />
            <SkeletonBar className="h-10 w-28" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 px-4 pb-4 sm:gap-3 sm:px-5 sm:pb-5 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            // The neutral chip of the real thing (glass/customer-page.css): the tone arrives with the figure.
            <div key={i} data-slot="customer-stat" data-tone="neutral" className="min-h-[6.5rem] rounded-2xl bg-paper-sunken p-3">
              <SkeletonBar className="h-2.5 w-16" />
              <SkeletonBar className="mt-4 h-5 w-14" />
              <SkeletonBar className="mt-3 w-24 max-w-full" />
            </div>
          ))}
        </div>
      </div>
      <div className="grid items-start gap-[var(--bento-gap)] lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-[var(--bento-gap)]">
          <CardSkeleton lines={5} />
          <CardSkeleton lines={1} />
          <CardSkeleton lines={1} />
        </div>
        <CardSkeleton lines={4} className="max-lg:hidden" />
      </div>
    </div>
  );
}
