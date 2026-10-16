import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionary";
import { REGISTER_URL } from "@/lib/urls";
import { ArrowIcon } from "./icons";
import { Ribbons } from "./ribbons";
import { ZimosLogo } from "./zimos-logo";

/**
 * Deep closing band — `primary-dark` in light, the deep `primary-soft` navy in
 * dark; white type reads on both. The logo sits on the plain half with
 * generous clear space; the ribbon motif stays on the opposite side.
 */
export function FinalCta({
  copy,
  brand,
  locale,
}: {
  copy: Dictionary["finalCta"];
  brand: Dictionary["brand"];
  locale: Locale;
}) {
  return (
    <section aria-labelledby="final-cta-heading" className="bg-paper px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <div className="relative isolate mx-auto max-w-7xl overflow-hidden rounded-3xl bg-primary-dark dark:bg-primary-soft px-6 py-14 sm:px-12 sm:py-20 lg:px-16 dark:ring-1 dark:ring-white/10">
        <Ribbons onDark className="inset-y-0 end-0 -z-10 hidden w-1/2 md:block" />

        <div className="max-w-xl">
          <ZimosLogo surface="dark" height={36} />

          <h2 id="final-cta-heading" className="mt-12 text-4xl font-bold text-white sm:text-5xl">
            {brand.limits}
          </h2>
          {brand.limitsLatin ? (
            <p className="mt-3 text-sm font-medium text-accent">
              <span lang="en" dir="ltr">
                {brand.limitsLatin}
              </span>
            </p>
          ) : null}
          <p className="mt-5 text-lg leading-relaxed text-pretty text-white/80">{copy.body}</p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <a
              href={REGISTER_URL}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-white px-6 text-base font-semibold text-primary-dark transition-colors duration-200 hover:bg-white/90 focus-visible:outline-white"
            >
              {copy.primaryCta}
              <ArrowIcon width="1.1rem" height="1.1rem" />
            </a>
            <a
              href={`/${locale}/contact`}
              className="inline-flex h-12 items-center justify-center rounded-lg border border-white/30 px-6 text-base font-medium text-white transition-colors duration-200 hover:bg-white/10 focus-visible:outline-white"
            >
              {copy.secondaryCta}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
