"use client";

import { useId, useState } from "react";
import type { Dictionary } from "@/i18n/dictionary";
import { ChevronDownIcon } from "./icons";
import { SectionHeading } from "./section-heading";
import { container } from "./ui";

/** Disclosure accordion: button[aria-expanded] in an h3, controlling a region. */
export function Faq({ copy }: { copy: Dictionary["faq"] }) {
  const baseId = useId();
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" aria-labelledby="faq-heading" className="bg-paper-raised py-20 sm:py-28">
      <div
        className={`${container} grid gap-10 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-16`}
      >
        <SectionHeading id="faq-heading" kicker={copy.kicker} heading={copy.heading} intro={copy.intro} />

        <ul className="divide-y divide-line rounded-2xl border border-line bg-paper">
          {copy.items.map((item, i) => {
            const isOpen = open === i;
            const buttonId = `${baseId}-q${i}`;
            const panelId = `${baseId}-a${i}`;
            return (
              <li key={item.question}>
                <h3 className="text-base font-semibold">
                  <button
                    id={buttonId}
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => setOpen(isOpen ? null : i)}
                    className="flex w-full cursor-pointer items-center justify-between gap-4 rounded-2xl px-5 py-4 text-start text-ink transition-colors hover:text-primary focus-visible:-outline-offset-2 sm:px-6 sm:py-5"
                  >
                    <span>{item.question}</span>
                    <span
                      aria-hidden
                      className={`flex size-8 shrink-0 items-center justify-center rounded-lg border border-line transition-transform duration-200 ${
                        isOpen ? "rotate-180 bg-primary-soft text-primary" : "text-ink-soft"
                      }`}
                    >
                      <ChevronDownIcon width="1rem" height="1rem" />
                    </span>
                  </button>
                </h3>
                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={buttonId}
                  hidden={!isOpen}
                  className="px-5 pb-5 sm:px-6 sm:pb-6"
                >
                  <p className="max-w-2xl leading-relaxed text-ink-soft">{item.answer}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
