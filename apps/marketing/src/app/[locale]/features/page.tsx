import type { Metadata } from "next";
import { FeatureVisual } from "@/components/feature-visuals";
import { FinalCta } from "@/components/final-cta";
import { CheckIcon } from "@/components/icons";
import { PageHero, PageShell } from "@/components/page-shell";
import { container } from "@/components/ui";
import { getDictionary } from "@/i18n/dictionaries";
import { featuresPage } from "@/i18n/pages/features-page";
import { pageMetadata, resolveLocale, type LocaleParams } from "@/lib/page";

export async function generateMetadata({ params }: { params: LocaleParams }): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const copy = featuresPage[locale];
  return pageMetadata(locale, "/features", copy.metaTitle, copy.metaDescription);
}

export default async function FeaturesPage({ params }: { params: LocaleParams }) {
  const locale = await resolveLocale(params);
  const dict = getDictionary(locale);
  const copy = featuresPage[locale];

  return (
    <PageShell locale={locale}>
      <PageHero kicker={copy.kicker} heading={copy.heading} intro={copy.intro}>
        <nav aria-label={copy.jumpTo} className="mt-8">
          <ul className="flex flex-wrap gap-2">
            {copy.areas.map((area) => (
              <li key={area.id}>
                <a
                  href={`#${area.id}`}
                  className="inline-flex rounded-full border border-line bg-paper-raised px-3 py-1.5 text-sm font-medium text-ink-soft transition-colors hover:border-zimos-blue hover:text-primary"
                >
                  {area.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </PageHero>

      <div className={`${container} space-y-20 py-16 sm:py-24 lg:space-y-28`}>
        {copy.areas.map((area, i) => {
          const flip = i % 2 === 1;
          return (
            <section
              key={area.id}
              id={area.id}
              aria-labelledby={`${area.id}-heading`}
              className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16"
            >
              <div className={flip ? "lg:order-2" : undefined}>
                <p className="text-sm font-semibold text-primary">{area.kicker}</p>
                <h2 id={`${area.id}-heading`} className="mt-3 text-2xl font-bold text-ink sm:text-3xl">
                  {area.title}
                </h2>
                <p className="mt-4 text-lg leading-relaxed text-pretty text-ink-soft">{area.body}</p>
                <ul className="mt-6 space-y-3">
                  {area.points.map((point) => (
                    <li key={point} className="flex gap-3 text-ink-soft">
                      <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
                        <CheckIcon width="0.9rem" height="0.9rem" />
                      </span>
                      <span className="leading-relaxed">{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className={flip ? "lg:order-1" : undefined}>
                <FeatureVisual area={area} />
              </div>
            </section>
          );
        })}
      </div>

      <FinalCta copy={dict.finalCta} brand={dict.brand} locale={locale} />
    </PageShell>
  );
}
