import type { Dictionary, HowStep } from "@/i18n/dictionary";
import { ChartIcon, PackageCheckIcon, StorefrontIcon, type IconComponent } from "./icons";
import { SectionHeading } from "./section-heading";
import { container } from "./ui";

const STEP_ICON: Record<HowStep["id"], IconComponent> = {
  build: StorefrontIcon,
  sell: PackageCheckIcon,
  grow: ChartIcon,
};

/** Build → Sell → Grow. Each card stacks one more slab: layers accumulating. */
export function HowItWorks({ copy }: { copy: Dictionary["howItWorks"] }) {
  return (
    <section id="how-it-works" aria-labelledby="how-heading" className="bg-paper-raised py-20 sm:py-28">
      <div className={container}>
        <SectionHeading
          id="how-heading"
          kicker={copy.kicker}
          heading={copy.heading}
          intro={copy.intro}
          align="center"
        />

        <ol className="mt-12 grid gap-4 md:grid-cols-3 lg:mt-16 lg:gap-6">
          {copy.steps.map((step, i) => {
            const Icon = STEP_ICON[step.id];
            return (
              <li
                key={step.id}
                className="relative flex flex-col overflow-hidden rounded-2xl border border-line bg-paper p-6 sm:p-8"
              >
                <div aria-hidden className="flex h-10 flex-col justify-end gap-1.5">
                  {Array.from({ length: i + 1 }, (_, k) => (
                    <span
                      key={k}
                      className="block h-2 -skew-x-[24deg] rounded-[3px] bg-linear-to-r from-primary to-accent rtl:bg-linear-to-l"
                      style={{ inlineSize: `${34 + (i - k) * 14}%`, opacity: 1 - k * 0.3 }}
                    />
                  ))}
                </div>

                <div className="mt-6 flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
                    <Icon width="1.25rem" height="1.25rem" />
                  </span>
                  <span className="text-sm font-semibold text-ink-soft">
                    {copy.stepLabel} {i + 1}
                  </span>
                </div>
                <h3 className="mt-5 text-2xl font-bold text-ink">{step.title}</h3>
                <p className="mt-3 leading-relaxed text-ink-soft">{step.body}</p>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
