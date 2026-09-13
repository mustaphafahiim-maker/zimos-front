import type { Dictionary } from "@/i18n/dictionary";
import { SectionHeading } from "./section-heading";
import { container } from "./ui";

/** Plain text chips only — no third-party logos. */
export function Integrations({ copy }: { copy: Dictionary["integrations"] }) {
  return (
    <section
      id="integrations"
      aria-labelledby="integrations-heading"
      className="border-y border-line/70 bg-paper-raised py-20 sm:py-24"
    >
      <div className={container}>
        <SectionHeading
          id="integrations-heading"
          kicker={copy.kicker}
          heading={copy.heading}
          intro={copy.intro}
          align="center"
        />

        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {copy.groups.map((group) => (
            <div key={group.label} className="rounded-2xl border border-line bg-paper p-5 sm:p-6">
              <h3 className="text-sm font-semibold text-ink-soft">{group.label}</h3>
              <ul className="mt-4 flex flex-wrap gap-2">
                {group.items.map((item) => (
                  <li
                    key={item}
                    lang="en"
                    dir="ltr"
                    className="inline-flex h-9 items-center rounded-lg border border-line bg-paper-raised px-3.5 text-sm font-medium text-ink"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="mt-6 text-center text-xs text-ink-soft">{copy.note}</p>
      </div>
    </section>
  );
}
