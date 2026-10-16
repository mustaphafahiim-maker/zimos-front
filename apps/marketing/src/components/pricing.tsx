import Link from "next/link";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionary";
import type { PublicPlan } from "@/lib/plans";
import { PlanCards, PricesComingSoon } from "./plan-cards";
import { SectionHeading } from "./section-heading";
import { container } from "./ui";

/**
 * "Payment is currently by manual transfer; refunds follow the refund policy",
 * under every list of prices.
 */
export function PaymentNote({ copy, locale }: { copy: Dictionary["pricing"]; locale: Locale }) {
  return (
    <p className="mt-8 text-center text-sm text-ink-soft">
      {copy.paymentNote}{" "}
      <Link href={`/${locale}/refund-policy`} className="font-medium text-primary underline underline-offset-2">
        {copy.refundLink}
      </Link>
      .
    </p>
  );
}

/**
 * The home page's pricing section: the plans on offer (GET /plans/public,
 * read on the server) in short, and the way to the full pricing page. When
 * no plan is published, or the API can't be reached, it says prices are
 * coming soon instead of disappearing.
 */
export function Pricing({
  copy,
  locale,
  plans,
}: {
  copy: Dictionary["pricing"];
  locale: Locale;
  plans: PublicPlan[] | null;
}) {
  return (
    <section id="pricing" aria-labelledby="pricing-heading" className="bg-paper py-20 sm:py-28">
      <div className={container}>
        <SectionHeading id="pricing-heading" kicker={copy.kicker} heading={copy.heading} intro={copy.intro} align="center" />

        {plans && plans.length > 0 ? (
          <div className="mt-10">
            <PlanCards plans={plans} copy={copy} locale={locale} idPrefix="home-pricing" compact />
          </div>
        ) : (
          <PricesComingSoon copy={copy} />
        )}

        <p className="mt-8 text-center">
          <Link
            href={`/${locale}/pricing`}
            className="inline-flex min-h-11 items-center gap-1 font-semibold text-primary underline-offset-4 hover:underline"
          >
            {copy.seeAll}
            <span aria-hidden className="inline-block rtl:rotate-180">
              →
            </span>
          </Link>
        </p>
        <PaymentNote copy={copy} locale={locale} />
      </div>
    </section>
  );
}
