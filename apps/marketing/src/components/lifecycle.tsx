import type { Dictionary } from "@/i18n/dictionary";
import { CheckIcon } from "./icons";
import { OrderLifecycle } from "./order-lifecycle";
import { SectionHeading } from "./section-heading";
import { container } from "./ui";

export function Lifecycle({ copy }: { copy: Dictionary["lifecycle"] }) {
  return (
    <section id="lifecycle" aria-labelledby="lifecycle-heading" className="border-y border-line/70 bg-paper py-20 sm:py-28">
      <div
        className={`${container} grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)] lg:items-center lg:gap-16`}
      >
        <div>
          <SectionHeading
            id="lifecycle-heading"
            kicker={copy.kicker}
            heading={copy.heading}
            intro={copy.intro}
          />
          <ul className="mt-8 space-y-3">
            {copy.points.map((point) => (
              <li key={point} className="flex gap-3 text-ink-soft">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
                  <CheckIcon width="0.9rem" height="0.9rem" />
                </span>
                <span className="leading-relaxed">{point}</span>
              </li>
            ))}
          </ul>
        </div>

        <OrderLifecycle />
      </div>
    </section>
  );
}
