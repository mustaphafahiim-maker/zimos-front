import { cn } from "@store-builder/ui";
import { CardSkeleton, SkeletonBar } from "@/components/DataState";

/**
 * The order page while its order loads: the hero's three facts and its
 * next-step strip, then the three open cards (items, money, notes) where they
 * will stand — two in the main column and one beside them from lg up, one
 * under the other on a phone. Same paddings as the real thing, so nothing
 * jumps when the order arrives. `DataState` wraps it in the "loading" status.
 */
export function OrderPageSkeleton() {
  return (
    <div className="flex flex-col gap-[var(--bento-gap)]">
      <div data-slot="skeleton-card" className="zimos-order-hero rounded-[1.75rem] bg-paper-raised shadow-[var(--shadow-card)] ring-1 ring-line">
        <div className="grid lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.9fr)_minmax(0,1.25fr)]">
          {[0, 1, 2].map((i) => (
            <div key={i} className={cn("p-4 sm:p-5", i > 0 && "border-t border-line lg:border-t-0 lg:border-s")}>
              <SkeletonBar className="h-2.5 w-14" />
              <SkeletonBar className={cn("mt-3.5 h-6", i === 1 ? "w-28" : "w-40 max-w-full")} />
              <SkeletonBar className="mt-3 w-32 max-w-full" />
              {i === 0 && (
                <div className="mt-4 flex gap-2">
                  <SkeletonBar className="h-11 flex-1 sm:w-24 sm:flex-none" />
                  <SkeletonBar className="h-11 flex-1 sm:w-28 sm:flex-none" />
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between gap-4 border-t border-line p-4 sm:p-5">
          <SkeletonBar className="w-3/5 max-w-80" />
          <SkeletonBar className="hidden h-12 w-40 md:block" />
        </div>
      </div>
      <div className="grid items-start gap-[var(--bento-gap)] lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-[var(--bento-gap)]">
          <CardSkeleton lines={4} />
          <CardSkeleton lines={3} />
        </div>
        <CardSkeleton lines={3} />
      </div>
    </div>
  );
}
