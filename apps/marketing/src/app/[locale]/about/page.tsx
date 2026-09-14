import type { Metadata } from "next";
import { FinalCta } from "@/components/final-cta";
import { ArrowIcon } from "@/components/icons";
import { PageHero, PageShell } from "@/components/page-shell";
import { SectionHeading } from "@/components/section-heading";
import { btnSecondary, container } from "@/components/ui";
import { getDictionary } from "@/i18n/dictionaries";
import { aboutPage } from "@/i18n/pages/about-page";
import { pageMetadata, resolveLocale, type LocaleParams } from "@/lib/page";

export async function generateMetadata({ params }: { params: LocaleParams }): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const copy = aboutPage[locale];
  return pageMetadata(locale, "/about", copy.metaTitle, copy.metaDescription);
}

export default async function AboutPage({ params }: { params: LocaleParams }) {
  const locale = await resolveLocale(params);
  const dict = getDictionary(locale);
  const copy = aboutPage[locale];

  return (
    <PageShell locale={locale}>
      <PageHero kicker={copy.kicker} heading={copy.heading} intro={copy.intro} />

      <section aria-labelledby="mission-heading" className="bg-paper py-20 sm:py-24">
        <div className={`${container} grid gap-10 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-16`}>
          <SectionHeading id="mission-heading" kicker={copy.mission.kicker} heading={copy.mission.heading} />
          <div className="space-y-5 text-lg leading-relaxed text-ink-soft">
            {copy.mission.body.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="approach-heading" className="bg-paper-raised py-20 sm:py-24">
        <div className={container}>
          <SectionHeading id="approach-heading" kicker={copy.approach.kicker} heading={copy.approach.heading} />
          <ul className="mt-12 grid gap-4 sm:grid-cols-2">
            {copy.approach.items.map((item) => (
              <li key={item.title} className="rounded-2xl border border-line bg-paper p-6 shadow-card sm:p-8">
                <span
                  aria-hidden
                  className="block h-1.5 w-6 -skew-x-[24deg] rounded-[2px] bg-linear-to-r from-zimos-blue to-zimos-sky"
                />
                <h3 className="mt-5 text-lg font-semibold text-ink">{item.title}</h3>
                <p className="mt-2 leading-relaxed text-ink-soft">{item.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="scope-heading" className="bg-paper py-20 sm:py-24">
        <div className={container}>
          <SectionHeading
            id="scope-heading"
            kicker={copy.scope.kicker}
            heading={copy.scope.heading}
            intro={copy.scope.body}
          />
          <a href={`/${locale}/features`} className={`${btnSecondary} mt-8 h-11 px-5 text-sm`}>
            {copy.scope.linkLabel}
            <ArrowIcon width="1rem" height="1rem" />
          </a>
        </div>
      </section>

      <FinalCta copy={dict.finalCta} brand={dict.brand} locale={locale} />
    </PageShell>
  );
}
