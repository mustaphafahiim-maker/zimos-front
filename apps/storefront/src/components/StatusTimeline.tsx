"use client";

import type { OrderStage } from "@/lib/mockCommerce";
import { useStore } from "@/lib/StoreContext";
import { CheckIcon } from "./Icons";

/**
 * Placed → Confirmation → Shipped → Delivered. `stage` is the step currently in
 * progress; earlier steps render as done. The last step at stage 3 is done too.
 */
export function StatusTimeline({ stage }: { stage: OrderStage }) {
  const { t } = useStore();
  const steps = [
    { title: t.timeline.placed, hint: t.timeline.placedHint },
    { title: t.timeline.confirmation, hint: t.timeline.confirmationHint },
    { title: t.timeline.shipped, hint: t.timeline.shippedHint },
    { title: t.timeline.delivered, hint: t.timeline.deliveredHint },
  ];

  return (
    <ol className="relative">
      {steps.map((step, i) => {
        const done = i < stage || (stage === 3 && i === 3);
        const current = i === stage && !done;
        const last = i === steps.length - 1;
        return (
          <li key={step.title} className="relative flex gap-4 pb-6 last:pb-0" aria-current={current ? "step" : undefined}>
            {!last && (
              <span
                aria-hidden
                className={`absolute start-[1.1875rem] top-10 h-[calc(100%-2.5rem)] w-0.5 ${
                  done ? "bg-primary" : "bg-line"
                }`}
              />
            )}
            <span
              className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold ${
                done
                  ? "border-primary bg-primary text-primary-foreground"
                  : current
                    ? "border-primary bg-primary-soft text-primary"
                    : "border-line bg-paper-raised text-ink-muted"
              }`}
            >
              {done ? <CheckIcon size={18} /> : i + 1}
            </span>
            <div className="pt-1.5">
              <p className={`text-sm font-semibold ${done || current ? "text-ink" : "text-ink-muted"}`}>
                {step.title}
                {current && (
                  <span className="ms-2 rounded-full bg-primary-soft px-2 py-0.5 text-xs font-medium text-primary">
                    {t.timeline.current}
                  </span>
                )}
                {done && <span className="sr-only"> — {t.timeline.done}</span>}
              </p>
              <p className="mt-0.5 text-sm text-ink-soft">{step.hint}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
