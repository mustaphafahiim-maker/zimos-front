import type { Metadata } from "next";
import { ArrowIcon } from "@/components/icons";
import { PageHero, PageShell } from "@/components/page-shell";
import { btnPrimary, container } from "@/components/ui";
import { helpPage } from "@/i18n/pages/help-page";
import { pageMetadata, resolveLocale, type LocaleParams } from "@/lib/page";

export async function generateMetadata({ params }: { params: LocaleParams }): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const copy = helpPage[locale];
  return pageMetadata(locale, "/help", copy.metaTitle, copy.metaDescription);
}

export default async function HelpPage({ params }: { params: LocaleParams }) {
  const locale = await resolveLocale(params);
  const copy = helpPage[locale];

  return (
    <PageShell locale={locale}>
      <PageHero kicker={copy.kicker} heading={copy.heading} intro={copy.intro} />

      {/* Category overview: cards link to articles further down this page. */}
      <section aria-labelledby="help-categories" className="bg-paper py-16 sm:py-20">
        <div className={container}>
          <h2 id="help-categories" className="sr-only">
            {copy.categoriesLabel}
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {copy.categories.map((category) => (
              <li key={category.id} className="flex flex-col rounded-2xl border border-line bg-paper-raised p-6 shadow-card">
                <h3 className="text-lg font-semibold text-ink">
                  <a href={`#${category.id}`} className="hover:text-primary">
                    {category.title}
                  </a>
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">{category.description}</p>
                <ul className="mt-4 space-y-2 border-t border-line pt-4">
                  {category.articles.map((article) => (
                    <li key={article.id}>
                      <a
                        href={`#${article.id}`}
                        className="flex items-center justify-between gap-2 text-sm font-medium text-primary hover:underline"
                      >
                        {article.title}
                        <ArrowIcon width="0.9rem" height="0.9rem" className="shrink-0" />
                      </a>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className={`${container} space-y-16 pb-20`}>
        {copy.categories.map((category) => (
          <section key={category.id} id={category.id} aria-labelledby={`${category.id}-heading`}>
            <h2 id={`${category.id}-heading`} className="text-2xl font-bold text-ink sm:text-3xl">
              {category.title}
            </h2>
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              {category.articles.map((article) => (
                <article
                  key={article.id}
                  id={article.id}
                  aria-labelledby={`${article.id}-heading`}
                  className="scroll-mt-24 rounded-2xl border border-line bg-paper-raised p-6 sm:p-8"
                >
                  <h3 id={`${article.id}-heading`} className="text-lg font-semibold text-ink">
                    {article.title}
                  </h3>
                  <p className="mt-2 text-ink-soft">{article.summary}</p>
                  <p className="sr-only">{copy.stepsLabel}</p>
                  <ol className="mt-5 space-y-3">
                    {article.steps.map((step, i) => (
                      <li key={step} className="flex gap-3 text-sm text-ink-soft">
                        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary">
                          {i + 1}
                        </span>
                        <span className="leading-relaxed">{step}</span>
                      </li>
                    ))}
                  </ol>
                </article>
              ))}
            </div>
          </section>
        ))}

        <section
          aria-labelledby="help-contact"
          className="rounded-3xl border border-line bg-linear-to-br from-primary-soft to-paper-raised p-8 sm:p-10 rtl:bg-linear-to-bl"
        >
          <h2 id="help-contact" className="text-2xl font-bold text-ink">
            {copy.contactHeading}
          </h2>
          <p className="mt-2 text-ink-soft">{copy.contactBody}</p>
          <a href={`/${locale}/contact`} className={`${btnPrimary} mt-6 h-11 px-5 text-sm`}>
            {copy.contactCta}
            <ArrowIcon width="1rem" height="1rem" />
          </a>
        </section>
      </div>
    </PageShell>
  );
}
