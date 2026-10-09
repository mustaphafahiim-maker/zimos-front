import { container, skeleton } from "../ui";
import { ProductLoadingLabel } from "./ProductLoadingLabel";

/**
 * Placeholders in the shape of the product page's parts, shown while the
 * server is still reading them: the whole page (the route's loading file) and
 * the parts that stream in after the photo and the buy box (questions,
 * similar products). Each is as tall as what replaces it is likely to be, so
 * the page does not jump when the real thing lands. Decorative: a screen
 * reader is told once that the page is loading.
 */

/** The page as it will be laid out: back link, photo square and thumbnails, then title, price, options and the two buttons. */
export function ProductPageSkeleton() {
  return (
    <main className="flex-1 pb-24 md:pb-0">
      <ProductLoadingLabel />
      <div aria-hidden className={`${container} py-6 sm:py-8`}>
        <div className="flex min-h-11 items-center">
          <span className={`h-4 w-28 ${skeleton}`} />
        </div>
        <div className="zt-pdp mt-2 grid gap-8 md:grid-cols-2 lg:gap-12">
          <div>
            <div className={`aspect-square rounded-2xl ${skeleton}`} />
            <div className="mt-3 flex gap-2 pb-1">
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className={`h-16 w-16 shrink-0 sm:h-20 sm:w-20 ${skeleton}`} />
              ))}
            </div>
          </div>
          <div className="flex min-w-0 flex-col gap-6">
            <div>
              <span className={`block h-8 w-4/5 ${skeleton}`} />
              <span className={`mt-3 block h-9 w-40 ${skeleton}`} />
              <span className={`mt-3 block h-5 w-24 ${skeleton}`} />
            </div>
            <div>
              <span className={`block h-5 w-20 ${skeleton}`} />
              <div className="mt-2 flex gap-2">
                {[0, 1, 2].map((i) => (
                  <span key={i} className={`h-12 w-16 ${skeleton}`} />
                ))}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <span className={`h-12 ${skeleton}`} />
              <span className={`h-12 ${skeleton}`} />
            </div>
            <div className="grid gap-1.5">
              <span className={`h-5 w-48 ${skeleton}`} />
              <span className={`h-5 w-56 ${skeleton}`} />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

/** «أسئلة وأجوبة»: its title and ask button, then two answered questions. */
export function QuestionsSkeleton() {
  return (
    <div aria-hidden className="mt-12">
      <div className="flex items-center justify-between gap-3">
        <span className={`h-7 w-36 ${skeleton}`} />
        <span className={`h-11 w-32 ${skeleton}`} />
      </div>
      <div className="mt-4 grid gap-3">
        <span className={`h-24 rounded-2xl ${skeleton}`} />
        <span className={`h-24 rounded-2xl ${skeleton}`} />
      </div>
    </div>
  );
}

/** Similar products: the title and a row of four cards (two across on a phone). */
export function RelatedSkeleton() {
  return (
    <div aria-hidden className="mt-12">
      <span className={`block h-7 w-40 ${skeleton}`} />
      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i}>
            <div className={`aspect-square rounded-2xl ${skeleton}`} />
            <span className={`mt-3 block h-4 w-4/5 ${skeleton}`} />
            <span className={`mt-2 block h-5 w-1/2 ${skeleton}`} />
            <span className={`mt-3 block h-11 ${skeleton}`} />
          </div>
        ))}
      </div>
    </div>
  );
}
