import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionary";
import { formatDays, formatNumber, formatPrice } from "@/lib/format";
import type { PublicPlan } from "@/lib/plans";
import { REGISTER_URL, registerUrlFor } from "@/lib/urls";
import { CheckIcon } from "./icons";
import { btnPrimary, btnSecondary } from "./ui";

type Copy = Dictionary["pricing"];

// Written out whole so Tailwind sees them: shown while monthly is chosen (the
// default), and while yearly is — keyed on the `cycle-yearly` input inside
// the same `group/pricing`.
const WHEN_MONTHLY = "group-has-[.cycle-yearly:checked]/pricing:hidden";
const WHEN_YEARLY_BLOCK = "hidden group-has-[.cycle-yearly:checked]/pricing:block";

/**
 * The plans as cards, rendered on the server: every price — monthly and
 * yearly — is in the page's HTML, so a reader, a payment provider's reviewer
 * or a search engine sees them without JavaScript. The monthly/yearly switch
 * is two radio buttons and CSS (`group-has-[…:checked]`), so it works without
 * JavaScript too. Each "Subscribe" goes to the dashboard's sign-up with the
 * plan and the cycle chosen.
 *
 * `compact` (the home page) leaves out the limits and features; the pricing
 * page shows everything.
 */
export function PlanCards({
  plans,
  copy,
  locale,
  idPrefix,
  compact = false,
  headingLevel = 3,
}: {
  plans: PublicPlan[];
  copy: Copy;
  locale: Locale;
  /** Unique per instance on a page: the switch's inputs are found by id. */
  idPrefix: string;
  compact?: boolean;
  /** 2 on the pricing page, under its h1; 3 in the home page's pricing section. */
  headingLevel?: 2 | 3;
}) {
  const PlanHeading = headingLevel === 2 ? "h2" : "h3";
  const monthlyId = `${idPrefix}-monthly`;
  const yearlyId = `${idPrefix}-yearly`;
  const limit = (value: number | null) => (value === null ? copy.unlimited : formatNumber(value, locale));
  const showYearly = plans.some((plan) => plan.yearlyPrice > 0);

  return (
    <div className="group/pricing">
      {showYearly ? (
        <fieldset className="mx-auto flex w-fit rounded-full border border-line bg-paper-raised p-1">
          <legend className="sr-only">{copy.billingCycle}</legend>
          <label
            htmlFor={monthlyId}
            className="flex min-h-11 cursor-pointer items-center rounded-full px-5 text-sm font-semibold text-ink-soft transition-colors has-[:checked]:bg-primary has-[:checked]:text-primary-foreground has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary/50"
          >
            <input id={monthlyId} type="radio" name={`${idPrefix}-cycle`} defaultChecked className="sr-only" />
            {copy.monthly}
          </label>
          <label
            htmlFor={yearlyId}
            className="flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full px-5 text-sm font-semibold text-ink-soft transition-colors has-[:checked]:bg-primary has-[:checked]:text-primary-foreground has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary/50"
          >
            <input id={yearlyId} type="radio" name={`${idPrefix}-cycle`} className="cycle-yearly sr-only" />
            {copy.yearly}
            <span className="text-xs font-medium opacity-80">({copy.yearlyNote})</span>
          </label>
        </fieldset>
      ) : null}

      <ul className={`mx-auto mt-10 grid max-w-6xl gap-4 lg:gap-6 ${plans.length >= 3 ? "lg:grid-cols-3" : plans.length === 2 ? "md:grid-cols-2 md:max-w-4xl" : "max-w-md"}`}>
        {plans.map((plan) => {
          const free = plan.monthlyPrice === 0;
          const whenMonthly = showYearly ? WHEN_MONTHLY : "";
          return (
            <li
              key={plan.id}
              aria-labelledby={`${idPrefix}-plan-${plan.id}`}
              className="relative flex flex-col overflow-hidden rounded-3xl border border-line bg-paper-raised p-6 sm:p-8"
            >
              <PlanHeading id={`${idPrefix}-plan-${plan.id}`} className="text-xl font-bold text-ink">
                {plan.name}
              </PlanHeading>

              <div className="mt-4">
                {free ? (
                  <p className="text-3xl font-bold text-ink">{copy.free}</p>
                ) : (
                  <>
                    <div className={whenMonthly}>
                      <p className="text-3xl font-bold text-ink">
                        {formatPrice(plan.monthlyPrice, plan.currency, locale)}{" "}
                        <span className="text-base font-medium text-ink-soft">{copy.perMonth}</span>
                      </p>
                      {showYearly ? (
                        <p className="mt-1 text-sm text-ink-soft">
                          {copy.yearlyEquivalent.replace("{price}", formatPrice(plan.yearlyPrice, plan.currency, locale))}
                        </p>
                      ) : null}
                    </div>
                    {showYearly ? (
                      <div className={WHEN_YEARLY_BLOCK}>
                        <p className="text-3xl font-bold text-ink">
                          {formatPrice(plan.yearlyPrice, plan.currency, locale)}{" "}
                          <span className="text-base font-medium text-ink-soft">{copy.perYear}</span>
                        </p>
                        <p className="mt-1 text-sm text-ink-soft">{copy.yearlyNote}</p>
                      </div>
                    ) : null}
                  </>
                )}
                <p className="mt-2 text-sm font-medium text-primary-dark dark:text-primary">
                  {plan.trialDays > 0 ? copy.trial.replace("{days}", formatDays(plan.trialDays, locale)) : copy.noTrial}
                </p>
              </div>

              {/* A free plan has one button, whichever cycle is chosen. */}
              <div className={`mt-6 ${free ? "" : whenMonthly}`}>
                <a href={registerUrlFor(plan.id, "monthly")} className={`${btnPrimary} h-11 w-full px-5 text-sm`}>
                  {copy.cta}
                </a>
              </div>
              {showYearly && !free ? (
                <div className={`mt-6 ${WHEN_YEARLY_BLOCK}`}>
                  <a href={registerUrlFor(plan.id, "yearly")} className={`${btnPrimary} h-11 w-full px-5 text-sm`}>
                    {copy.ctaYearly}
                  </a>
                </div>
              ) : null}

              {compact ? null : (
                <>
                  <dl className="mt-6 grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 border-t border-line pt-6 text-sm">
                    <dt className="text-ink-soft">{copy.stores}</dt>
                    <dd className="text-end font-medium text-ink">{limit(plan.maxStores)}</dd>
                    <dt className="text-ink-soft">{copy.funnels}</dt>
                    <dd className="text-end font-medium text-ink">{limit(plan.maxFunnelsPerMonth)}</dd>
                    {plan.softOrderQuota !== null ? (
                      <>
                        <dt className="text-ink-soft">{copy.orders}</dt>
                        <dd className="text-end font-medium text-ink">{formatNumber(plan.softOrderQuota, locale)}</dd>
                      </>
                    ) : null}
                  </dl>
                  {plan.features.length > 0 ? (
                    <ul className="mt-6 space-y-3 border-t border-line pt-6">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex gap-3 text-sm text-ink-soft">
                          <CheckIcon width="1.1rem" height="1.1rem" className="mt-px shrink-0 text-primary" />
                          <span className="leading-relaxed">{copy.features[feature] ?? feature}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** The plans are not published yet (or the API is out of reach): said kindly, never as an error. */
export function PricesComingSoon({ copy }: { copy: Copy }) {
  return (
    <div className="mx-auto mt-10 max-w-xl rounded-3xl border border-line bg-paper-raised p-8 text-center">
      <p className="text-xl font-bold text-ink">{copy.comingSoon}</p>
      <p className="mt-3 text-sm leading-relaxed text-ink-soft">{copy.comingSoonBody}</p>
      <a href={REGISTER_URL} className={`${btnSecondary} mt-6 h-11 px-5 text-sm`}>
        {copy.comingSoonCta}
      </a>
    </div>
  );
}
