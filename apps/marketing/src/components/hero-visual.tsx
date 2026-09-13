import type { HeroVisual as HeroVisualCopy } from "@/i18n/dictionary";
import { ChatIcon, CheckIcon, StorefrontIcon } from "./icons";
import { layerDelay } from "./ui";

/**
 * A mini dashboard mock in HTML/CSS: funnel steps, an order pipeline, and a
 * confirmation card stacking on top. Order numbers are UI illustration only —
 * no metrics. The whole thing is one image to assistive tech.
 */

const PIPELINE: [number[], number[], number[]] = [
  [1027, 1026],
  [1024, 1025],
  [1023],
];
const HIGHLIGHT = 1024;

export function HeroVisual({ copy }: { copy: HeroVisualCopy }) {
  return (
    <div
      role="img"
      aria-label={copy.aria}
      className="relative mx-auto w-full max-w-[34rem] pb-12 lg:mx-0 lg:justify-self-end"
    >
      {/* Back layer — offset toward the inline end. */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 bottom-12 translate-x-3 translate-y-3 rounded-3xl border border-line bg-primary-soft rtl:-translate-x-3 sm:translate-x-4 sm:translate-y-4 sm:rtl:-translate-x-4"
      />

      <div
        className="z-layer relative rounded-3xl border border-line bg-paper-raised p-4 shadow-pop sm:p-5"
        style={layerDelay(60)}
      >
        <div className="flex items-center justify-between gap-3 border-b border-line pb-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
              <StorefrontIcon width="1rem" height="1rem" />
            </span>
            <span className="truncate text-sm font-semibold text-ink">{copy.storeLabel}</span>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary-soft px-2.5 py-1 text-xs font-medium text-primary-dark">
            <span className="size-1.5 rounded-full bg-zimos-blue" />
            {copy.liveLabel}
          </span>
        </div>

        {/* Funnel: Landing → Checkout → Upsell → Thank you */}
        <div className="mt-4">
          <p className="text-xs font-semibold text-ink-soft">{copy.funnelTitle}</p>
          <ol className="relative mt-3 grid grid-cols-4 gap-2">
            <span
              aria-hidden
              className="absolute start-[12.5%] end-[12.5%] top-4 h-0.5 rounded-full bg-linear-to-r from-zimos-blue to-zimos-sky rtl:bg-linear-to-l"
            />
            {copy.funnelSteps.map((label, i) => (
              <li key={label} className="relative flex flex-col items-center gap-2 text-center">
                <span
                  className={`flex size-8 items-center justify-center rounded-lg border text-xs font-semibold ${
                    i === 0
                      ? "border-zimos-blue bg-zimos-blue text-white"
                      : "border-line-strong bg-paper-raised text-primary"
                  }`}
                >
                  {i + 1}
                </span>
                <span className="text-[11px] leading-tight font-medium text-ink-soft sm:text-xs">
                  {label}
                </span>
              </li>
            ))}
          </ol>
        </div>

        {/* Order pipeline */}
        <div className="mt-5 rounded-2xl border border-line bg-paper p-3">
          <p className="text-xs font-semibold text-ink-soft">{copy.pipelineTitle}</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {copy.columns.map((column, c) => (
              <div key={column} className="min-w-0">
                <p className="truncate text-[11px] font-medium text-ink-soft">{column}</p>
                <ul className="mt-2 space-y-2">
                  {PIPELINE[c].map((n) => (
                    <li
                      key={n}
                      className={`rounded-lg border bg-paper-raised p-2 ${
                        n === HIGHLIGHT
                          ? "border-zimos-blue ring-2 ring-zimos-blue/15"
                          : "border-line"
                      }`}
                    >
                      <p className="truncate text-[11px] font-semibold text-ink">
                        {copy.order} #{n}
                      </p>
                      <span className="mt-1.5 block h-1.5 w-4/5 rounded-full bg-line" />
                      <span className="mt-1 block h-1.5 w-1/2 rounded-full bg-line" />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Confirmation card stacking on top. */}
      <div className="absolute end-2 bottom-0 w-[16rem] max-w-[85%] sm:-end-4">
        <div
          className="z-layer flex items-start gap-3 rounded-2xl border border-line bg-paper-raised p-3.5 shadow-pop"
          style={layerDelay(280)}
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-zimos-blue text-white">
            <CheckIcon width="1.1rem" height="1.1rem" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">
              {copy.order} #{HIGHLIGHT} · {copy.confirmTitle}
            </p>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-soft">
              <ChatIcon width="0.85rem" height="0.85rem" className="shrink-0 text-primary" />
              {copy.confirmBody}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
