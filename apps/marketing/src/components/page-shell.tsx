import type { ReactNode } from "react";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { Ribbons } from "./ribbons";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";
import { container } from "./ui";

/** Header + <main> + footer, shared by every inner page. */
export function PageShell({ locale, children }: { locale: Locale; children: ReactNode }) {
  const dict = getDictionary(locale);
  return (
    <>
      <SiteHeader />
      <main id="main">{children}</main>
      <SiteFooter copy={dict.footer} brand={dict.brand} locale={locale} />
    </>
  );
}

/** Top band of an inner page: kicker, the page's single <h1>, intro. */
export function PageHero({
  kicker,
  heading,
  intro,
  children,
}: {
  kicker: string;
  heading: string;
  intro?: string;
  children?: ReactNode;
}) {
  return (
    <section
      aria-labelledby="page-heading"
      className="relative isolate overflow-hidden border-b border-line/70 bg-linear-to-b from-paper-raised to-paper"
    >
      <Ribbons className="inset-y-0 end-0 -z-10 hidden w-1/2 md:block" />
      <div className={`${container} py-14 sm:py-20`}>
        <div className="max-w-3xl">
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
            <span
              aria-hidden
              className="h-1.5 w-4 -skew-x-[24deg] rounded-[2px] bg-linear-to-r from-zimos-blue to-zimos-sky"
            />
            {kicker}
          </p>
          <h1 id="page-heading" className="mt-3 text-4xl font-bold text-ink sm:text-5xl">
            {heading}
          </h1>
          {intro ? (
            <p className="mt-5 text-lg leading-relaxed text-pretty text-ink-soft sm:text-xl">{intro}</p>
          ) : null}
          {children}
        </div>
      </div>
    </section>
  );
}
