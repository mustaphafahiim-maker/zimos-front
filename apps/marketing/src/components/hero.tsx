import type { Dictionary } from "@/i18n/dictionary";
import { REGISTER_URL } from "@/lib/urls";
import { HeroVisual } from "./hero-visual";
import { ArrowIcon } from "./icons";
import { Ribbons } from "./ribbons";
import { btnPrimary, btnSecondary, container } from "./ui";

export function Hero({
  copy,
  brand,
}: {
  copy: Dictionary["hero"];
  brand: Dictionary["brand"];
}) {
  return (
    <section
      aria-labelledby="hero-heading"
      className="relative isolate overflow-hidden border-b border-line/70 bg-linear-to-b from-paper-raised to-paper"
    >
      <Ribbons className="inset-y-0 end-0 -z-10 w-full lg:w-[62%]" />

      <div
        className={`${container} grid gap-14 pt-12 pb-20 sm:pt-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,34rem)] lg:items-center lg:gap-12 lg:pt-24 lg:pb-28`}
      >
        <div className="max-w-xl">
          <p className="inline-flex items-center gap-2 rounded-full border border-line bg-paper-raised/80 px-3 py-1 text-sm font-medium text-ink-soft">
            <span aria-hidden className="size-1.5 rounded-full bg-zimos-blue" />
            {copy.kicker}
          </p>

          <h1 id="hero-heading" className="mt-6 text-5xl font-bold text-ink sm:text-6xl lg:text-7xl">
            {copy.headline}
          </h1>
          {brand.loopLatin ? (
            <p className="mt-3 text-sm font-medium text-primary">
              <span lang="en" dir="ltr">
                {brand.loopLatin}
              </span>
            </p>
          ) : null}

          <p className="mt-6 text-lg leading-relaxed text-pretty text-ink-soft sm:text-xl">
            {copy.subheadline}
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <a href={REGISTER_URL} className={`${btnPrimary} h-12 px-6 text-base`}>
              {copy.primaryCta}
              <ArrowIcon width="1.1rem" height="1.1rem" />
            </a>
            <a href="#how-it-works" className={`${btnSecondary} h-12 px-6 text-base`}>
              {copy.secondaryCta}
            </a>
          </div>
          <p className="mt-4 text-sm text-ink-soft">{copy.ctaNote}</p>
        </div>

        <HeroVisual copy={copy.visual} />
      </div>
    </section>
  );
}
