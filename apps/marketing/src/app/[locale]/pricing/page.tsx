import type { Metadata } from "next";
import { Faq } from "@/components/faq";
import { FinalCta } from "@/components/final-cta";
import { CheckIcon, CloseIcon } from "@/components/icons";
import { PageHero, PageShell } from "@/components/page-shell";
import { Pricing } from "@/components/pricing";
import { SectionHeading } from "@/components/section-heading";
import { container } from "@/components/ui";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import {
  COMPARISON,
  PRICING_FAQ_INDICES,
  pricingPage,
  type Availability,
  type PricingPageCopy,
} from "@/i18n/pages/pricing-page";
import { pageMetadata, resolveLocale, type LocaleParams } from "@/lib/page";

export async function generateMetadata({ params }: { params: LocaleParams }): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const copy = pricingPage[locale];
  return pageMetadata(locale, "/pricing", copy.metaTitle, copy.metaDescription);
}

export default async function PricingPage({ params }: { params: LocaleParams }) {
  const locale = await resolveLocale(params);
  const dict = getDictionary(locale);
  const copy = pricingPage[locale];

  return (
    <PageShell locale={locale}>
      <PageHero kicker={dict.pricing.kicker} heading={dict.pricing.heading} intro={dict.pricing.intro} />
      <Pricing
        copy={{ ...dict.pricing, heading: copy.plansHeading, intro: undefined }}
        locale={locale}
      />
      <Comparison copy={copy} plans={dict.pricing.plans.map((p) => p.name)} locale={locale} />
      <Faq
        copy={{
          ...dict.faq,
          heading: copy.faqHeading,
          intro: copy.faqIntro,
          items: PRICING_FAQ_INDICES.map((i) => dict.faq.items[i]).filter(Boolean),
        }}
      />
      <FinalCta copy={dict.finalCta} brand={dict.brand} locale={locale} />
    </PageShell>
  );
}

function Cell({ value, copy }: { value: Availability; copy: PricingPageCopy["compare"] }) {
  if (value === "yes") {
    return (
      <span className="inline-flex size-7 items-center justify-center rounded-full bg-primary-soft text-primary">
        <CheckIcon width="1rem" height="1rem" />
        <span className="sr-only">{copy.yes}</span>
      </span>
    );
  }
  if (value === "no") {
    return (
      <span className="inline-flex size-7 items-center justify-center text-ink-muted">
        <CloseIcon width="0.9rem" height="0.9rem" />
        <span className="sr-only">{copy.no}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full border border-line px-2 py-0.5 text-xs font-medium whitespace-nowrap text-ink-soft">
      {copy.tbd}
    </span>
  );
}

function Comparison({
  copy,
  plans,
  locale,
}: {
  copy: PricingPageCopy;
  plans: string[];
  locale: Locale;
}) {
  const c = copy.compare;
  return (
    <section id="compare" aria-labelledby="compare-heading" className="bg-paper-raised py-20 sm:py-28">
      <div className={container}>
        <SectionHeading id="compare-heading" kicker={c.kicker} heading={c.heading} intro={c.intro} />

        <div className="mt-12 overflow-x-auto rounded-2xl border border-line bg-paper">
          <table className="w-full min-w-[40rem] border-collapse text-sm">
            <caption className="sr-only">{c.caption}</caption>
            <thead>
              <tr className="border-b border-line bg-paper-raised">
                <th scope="col" className="px-5 py-4 text-start font-semibold text-ink">
                  {c.featureColumn}
                </th>
                {plans.map((plan) => (
                  <th scope="col" key={plan} className="w-[18%] px-4 py-4 text-center font-semibold text-ink">
                    {plan}
                  </th>
                ))}
              </tr>
            </thead>
            {COMPARISON.map((group) => (
              <tbody key={group.id}>
                <tr>
                  <th
                    scope="colgroup"
                    colSpan={plans.length + 1}
                    className="bg-primary-soft px-5 py-3 text-start text-xs font-semibold tracking-wide text-primary-dark dark:text-zimos-sky"
                  >
                    {group.title[locale]}
                  </th>
                </tr>
                {group.rows.map((row) => (
                  <tr key={row.label.en} className="border-t border-line">
                    <th scope="row" className="px-5 py-3.5 text-start font-normal text-ink-soft">
                      {row.label[locale]}
                    </th>
                    {row.values.map((value, i) => (
                      <td key={i} className="px-4 py-3.5 text-center">
                        <Cell value={value} copy={c} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-ink-soft">{c.note}</p>
      </div>
    </section>
  );
}
