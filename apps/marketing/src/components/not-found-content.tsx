import type { Dictionary } from "@/i18n/dictionary";
import type { Locale } from "@/i18n/config";
import { Ribbons } from "./ribbons";
import { btnPrimary, btnSecondary, container } from "./ui";

/** Branded 404 body, shared by the `[locale]` not-found and the global one. */
export function NotFoundContent({ copy, locale }: { copy: Dictionary["notFound"]; locale: Locale }) {
  return (
    <section
      aria-labelledby="not-found-heading"
      className="relative isolate overflow-hidden bg-linear-to-b from-paper-raised to-paper"
    >
      <Ribbons className="inset-y-0 end-0 -z-10 hidden w-1/2 md:block" />
      <div className={`${container} py-20 sm:py-28`}>
        <div className="max-w-xl">
          <p className="text-sm font-semibold text-primary">404</p>
          <h1 id="not-found-heading" className="mt-3 text-4xl font-bold text-ink sm:text-5xl">
            {copy.heading}
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-ink-soft">{copy.body}</p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <a href={`/${locale}`} className={`${btnPrimary} h-12 px-6 text-base`}>
              {copy.home}
            </a>
            <a href={`/${locale}/help`} className={`${btnSecondary} h-12 px-6 text-base`}>
              {copy.help}
            </a>
            <a href={`/${locale}/contact`} className={`${btnSecondary} h-12 px-6 text-base`}>
              {copy.contact}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
