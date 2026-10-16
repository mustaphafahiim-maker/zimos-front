"use client";

import { useStore } from "@/lib/StoreContext";
import { CheckIcon } from "../Icons";

export type CheckoutStep = "contact" | "address" | "confirm";

/**
 * Contact → Address → Confirm across the top of the checkout page. The page
 * is one form; the indicator only shows how far the shopper has got — a step
 * is "done" once its fields validate, and the first step that does not is
 * the current one. A connector fills in behind each completed step.
 */
export function CheckoutProgress({ done, current }: { done: CheckoutStep[]; current: CheckoutStep }) {
  const { t } = useStore();
  const steps: { id: CheckoutStep; label: string }[] = [
    { id: "contact", label: t.shop.stepContact },
    { id: "address", label: t.shop.stepAddress },
    { id: "confirm", label: t.shop.stepConfirm },
  ];
  const currentIndex = steps.findIndex((s) => s.id === current);

  return (
    <ol aria-label={t.shop.stepOf(currentIndex + 1, steps.length)} className="flex items-center gap-2 sm:gap-3">
      {steps.map((step, i) => {
        const isDone = done.includes(step.id);
        const isCurrent = step.id === current;
        return (
          <li key={step.id} className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3" aria-current={isCurrent ? "step" : undefined}>
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors ${
                isDone
                  ? "border-primary bg-primary text-on-primary"
                  : isCurrent
                    ? "border-primary bg-primary-soft text-primary"
                    : "border-line bg-paper-raised text-ink-soft"
              }`}
            >
              {isDone ? <CheckIcon size={16} /> : i + 1}
            </span>
            <span className={`truncate text-sm font-medium ${isDone || isCurrent ? "text-ink" : "text-ink-soft"}`}>
              {step.label}
              {isDone && <span className="sr-only"> — {t.timeline.done}</span>}
            </span>
            {i < steps.length - 1 && (
              <span aria-hidden className={`h-0.5 min-w-4 flex-1 rounded-full transition-colors ${isDone ? "bg-primary" : "bg-line"}`} />
            )}
          </li>
        );
      })}
    </ol>
  );
}
