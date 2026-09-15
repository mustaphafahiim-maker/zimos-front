import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionary";
import { REGISTER_URL } from "@/lib/urls";
import { CheckIcon } from "./icons";
import { SectionHeading } from "./section-heading";
import { btnPrimary, btnSecondary, container } from "./ui";

/**
 * No public prices exist, so plans show names, who they are for, and feature
 * lists only — no invented prices, and therefore no monthly/yearly toggle.
 */
export function Pricing({ copy, locale }: { copy: Dictionary["pricing"]; locale: Locale }) {
  return (
    <section id="pricing" aria-labelledby="pricing-heading" className="bg-paper py-20 sm:py-28">
      <div className={container}>
        <SectionHeading
          id="pricing-heading"
          kicker={copy.kicker}
          heading={copy.heading}
          intro={copy.intro}
          align="center"
        />
        <p className="mt-6 flex justify-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary-dark dark:text-primary">
            <span aria-hidden className="size-1.5 rounded-full bg-primary" />
            {copy.badge}
          </span>
        </p>

        <ul className="mx-auto mt-12 grid max-w-6xl gap-4 lg:grid-cols-3 lg:gap-6">
          {copy.plans.map((plan) => {
            const contact = plan.id === "scale";
            return (
              <li
                key={plan.id}
                aria-labelledby={`plan-${plan.id}`}
                className="relative flex flex-col overflow-hidden rounded-3xl border border-line bg-paper-raised p-6 sm:p-8"
              >
                {plan.id === "growth" ? (
                  <span
                    aria-hidden
                    className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-primary to-accent rtl:bg-linear-to-l"
                  />
                ) : null}
                <h3 id={`plan-${plan.id}`} className="text-xl font-bold text-ink">
                  {plan.name}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft lg:min-h-[2.75rem]">
                  {plan.description}
                </p>

                <a
                  href={contact ? `/${locale}/contact` : REGISTER_URL}
                  className={`${contact ? btnSecondary : btnPrimary} mt-6 h-11 px-5 text-sm`}
                >
                  {plan.cta}
                </a>

                <ul className="mt-6 space-y-3 border-t border-line pt-6">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-3 text-sm text-ink-soft">
                      <CheckIcon width="1.1rem" height="1.1rem" className="mt-px shrink-0 text-primary" />
                      <span className="leading-relaxed">{feature}</span>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>

        <p className="mt-6 text-center text-sm text-ink-soft">{copy.note}</p>
      </div>
    </section>
  );
}
