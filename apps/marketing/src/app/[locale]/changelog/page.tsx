import type { Metadata } from "next";
import { CheckIcon } from "@/components/icons";
import { PageHero, PageShell } from "@/components/page-shell";
import { container } from "@/components/ui";
import { CHANGELOG } from "@/data/changelog";
import type { Locale } from "@/i18n/config";
import { pageMetadata, resolveLocale, type LocaleParams } from "@/lib/page";

const copy: Record<Locale, { title: string; description: string; kicker: string; heading: string; intro: string }> = {
  en: {
    title: "Changelog",
    description: "New features and improvements in ZIMOS.",
    kicker: "Changelog",
    heading: "What's new in ZIMOS",
    intro: "The features and improvements we've shipped, newest first.",
  },
  ar: {
    title: "سجل التحديثات",
    description: "المزايا والتحسينات الجديدة في ZIMOS.",
    kicker: "سجل التحديثات",
    heading: "الجديد في ZIMOS",
    intro: "المزايا والتحسينات التي أطلقناها، الأحدث أولًا.",
  },
};

export async function generateMetadata({ params }: { params: LocaleParams }): Promise<Metadata> {
  const locale = await resolveLocale(params);
  return pageMetadata(locale, "/changelog", copy[locale].title, copy[locale].description);
}

export default async function ChangelogPage({ params }: { params: LocaleParams }) {
  const locale = await resolveLocale(params);
  const c = copy[locale];

  return (
    <PageShell locale={locale}>
      <PageHero kicker={c.kicker} heading={c.heading} intro={c.intro} />
      <div className={`${container} py-16 sm:py-20`}>
        <ol className="relative mx-auto max-w-3xl border-s border-line ps-6 sm:ps-10">
          {CHANGELOG.map((entry) => (
            <li key={entry.id} id={entry.id} className="relative pb-12 last:pb-0">
              <span
                aria-hidden
                className="absolute -start-[1.95rem] top-1.5 size-3 rounded-full border-2 border-paper bg-zimos-blue ring-2 ring-zimos-sky/40 sm:-start-[2.95rem]"
              />
              <article aria-labelledby={`${entry.id}-heading`} className="rounded-2xl border border-line bg-paper-raised p-6 shadow-card sm:p-8">
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <span className="rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-semibold text-primary-dark dark:text-zimos-sky">
                    {entry.tag[locale]}
                  </span>
                  <span className="text-ink-soft">{entry.date}</span>
                </div>
                <h2 id={`${entry.id}-heading`} className="mt-4 text-2xl font-bold text-ink">
                  {entry.title[locale]}
                </h2>
                <p className="mt-3 leading-relaxed text-ink-soft">{entry.body[locale]}</p>
                <ul className="mt-5 space-y-2.5">
                  {entry.points[locale].map((point) => (
                    <li key={point} className="flex gap-3 text-sm text-ink-soft">
                      <CheckIcon width="1.1rem" height="1.1rem" className="mt-px shrink-0 text-primary" />
                      <span className="leading-relaxed">{point}</span>
                    </li>
                  ))}
                </ul>
              </article>
            </li>
          ))}
        </ol>
      </div>
    </PageShell>
  );
}
