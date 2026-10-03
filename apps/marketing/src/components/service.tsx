import type { Dictionary } from "@/i18n/dictionary";
import { CheckIcon } from "./icons";
import { SectionHeading } from "./section-heading";
import { container } from "./ui";

/**
 * What ZIMOS is and what is sold, in plain words: a SaaS platform for
 * building online stores, paid for as a monthly or yearly subscription.
 */
export function Service({ copy }: { copy: Dictionary["service"] }) {
  return (
    <section id="service" aria-labelledby="service-heading" className="border-y border-line bg-paper-raised py-16 sm:py-20">
      <div className={`${container} grid gap-10 lg:grid-cols-2 lg:items-center`}>
        <div>
          <SectionHeading id="service-heading" kicker={copy.kicker} heading={copy.heading} />
          <p className="mt-4 text-lg leading-relaxed text-pretty text-ink-soft">{copy.body}</p>
        </div>
        <ul className="space-y-4">
          {copy.points.map((point) => (
            <li key={point} className="flex gap-3 rounded-2xl border border-line bg-paper p-4 text-ink">
              <CheckIcon width="1.2rem" height="1.2rem" className="mt-0.5 shrink-0 text-primary" />
              <span className="leading-relaxed">{point}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
