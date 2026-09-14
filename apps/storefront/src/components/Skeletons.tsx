import { container } from "./ui";

/**
 * Instant loading states (rendered by route `loading.tsx` files) shaped like
 * the real page, so navigation feels immediate and nothing jumps when content
 * streams in. Pulse only when the shopper allows motion.
 */
const bone = "rounded-xl bg-line/70 motion-safe:animate-pulse";

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="overflow-hidden rounded-2xl border border-line bg-paper-raised">
          <div className="aspect-square bg-line/60 motion-safe:animate-pulse" />
          <div className="space-y-2 p-4">
            <div className={`${bone} h-4 w-4/5`} />
            <div className={`${bone} h-4 w-1/3`} />
            <div className={`${bone} mt-3 h-11 w-full`} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function HomeSkeleton() {
  return (
    <main className="flex-1" aria-busy="true">
      <div className={`${container} py-8`}>
        <div className="grid items-center gap-8 md:grid-cols-2">
          <div className="space-y-4">
            <div className={`${bone} h-4 w-24`} />
            <div className={`${bone} h-10 w-11/12`} />
            <div className={`${bone} h-10 w-2/3`} />
            <div className={`${bone} h-5 w-4/5`} />
            <div className="flex gap-3 pt-2">
              <div className={`${bone} h-12 w-36`} />
              <div className={`${bone} h-12 w-32`} />
            </div>
          </div>
          <div className="aspect-[4/3] rounded-2xl bg-line/60 motion-safe:animate-pulse" />
        </div>
        <div className="mt-12">
          <div className={`${bone} mx-auto mb-6 h-7 w-48`} />
          <ProductGridSkeleton />
        </div>
      </div>
    </main>
  );
}

export function ProductSkeleton() {
  return (
    <main className="flex-1" aria-busy="true">
      <div className={`${container} py-6 sm:py-8`}>
        <div className={`${bone} h-5 w-20`} />
        <div className="mt-4 grid gap-8 md:grid-cols-2 lg:gap-12">
          <div>
            <div className="aspect-square rounded-2xl bg-line/60 motion-safe:animate-pulse" />
            <div className="mt-3 flex gap-2">
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className={`${bone} h-16 w-16 sm:h-20 sm:w-20`} />
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <div className={`${bone} h-8 w-4/5`} />
            <div className={`${bone} h-9 w-32`} />
            <div className={`${bone} h-4 w-24`} />
            <div className="flex gap-2 pt-2">
              {Array.from({ length: 3 }, (_, i) => (
                <div key={i} className={`${bone} h-11 w-16`} />
              ))}
            </div>
            <div className={`${bone} h-12 w-full`} />
            <div className="h-80 rounded-2xl border-2 border-line bg-paper-raised p-5">
              <div className={`${bone} h-6 w-40`} />
              <div className="mt-5 space-y-4">
                <div className={`${bone} h-11 w-full`} />
                <div className={`${bone} h-11 w-full`} />
                <div className={`${bone} h-11 w-full`} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

export function CollectionSkeleton() {
  return (
    <main className="flex-1" aria-busy="true">
      <div className={`${container} py-8`}>
        <div className={`${bone} h-8 w-56`} />
        <div className={`${bone} mt-3 h-4 w-80 max-w-full`} />
        <div className="mt-8">
          <ProductGridSkeleton />
        </div>
      </div>
    </main>
  );
}
