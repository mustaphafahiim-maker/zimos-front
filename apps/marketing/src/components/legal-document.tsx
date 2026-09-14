import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import type { LegalDoc } from "@/i18n/pages/legal";
import { COMPANY } from "@/lib/company";
import { PageHero } from "./page-shell";
import { container } from "./ui";

/** A legal template: warning banner, table of contents, numbered sections. */
export function LegalDocument({ doc, locale }: { doc: LegalDoc; locale: Locale }) {
  const { common } = getDictionary(locale);

  return (
    <>
      <PageHero kicker={doc.kicker} heading={doc.title} intro={doc.intro}>
        <p className="mt-6 text-sm text-ink-soft">
          {common.lastUpdated}: <span className="font-medium text-ink">{COMPANY.legalLastUpdated}</span>
        </p>
      </PageHero>

      <div className={`${container} py-12 sm:py-16`}>
        <div
          role="note"
          className="mb-10 rounded-2xl border border-warning/40 bg-warning-soft px-5 py-4 text-warning"
        >
          <p className="font-semibold">{common.templateBanner}</p>
          <p className="mt-1 text-sm leading-relaxed">{common.templateBannerBody}</p>
        </div>

        <div className="grid gap-10 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-16">
          <nav aria-labelledby="toc-heading" className="lg:sticky lg:top-24 lg:self-start">
            <h2 id="toc-heading" className="text-sm font-semibold text-ink">
              {common.onThisPage}
            </h2>
            <ol className="mt-4 space-y-2 border-s border-line ps-4 text-sm">
              {doc.sections.map((section, i) => (
                <li key={section.id}>
                  <a href={`#${section.id}`} className="text-ink-soft transition-colors hover:text-primary">
                    {i + 1}. {section.heading}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <article className="max-w-3xl">
            {doc.sections.map((section, i) => (
              <section
                key={section.id}
                id={section.id}
                aria-labelledby={`${section.id}-heading`}
                className="border-b border-line py-8 first:pt-0 last:border-b-0"
              >
                <h2 id={`${section.id}-heading`} className="text-2xl font-bold text-ink">
                  {i + 1}. {section.heading}
                </h2>
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph} className="mt-4 leading-relaxed text-ink-soft">
                    {paragraph}
                  </p>
                ))}
                {section.list ? (
                  <ul className="mt-4 list-disc space-y-2 ps-6 leading-relaxed text-ink-soft marker:text-primary">
                    {section.list.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ))}
            <p className="pt-6 text-sm">
              <a href="#main" className="text-primary hover:underline">
                {common.backToTop}
              </a>
            </p>
          </article>
        </div>
      </div>
    </>
  );
}
