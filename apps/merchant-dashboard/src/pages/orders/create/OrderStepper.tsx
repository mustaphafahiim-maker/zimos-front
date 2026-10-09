import { cn } from "@store-builder/ui";
import { IconCheck } from "@/components/icons";
import { fmt, useT } from "@/i18n/LocaleContext";
import { CREATE_STRINGS } from "./strings";
import { STEP_COUNT, type StepIndex } from "./model";
import type { CreateOrder } from "./useCreateOrder";

const ORDER: readonly StepIndex[] = [0, 1, 2];

type StepState = "current" | "done" | "todo";

// A pill is 36px to the eye and 44px to the thumb: the ::before is the rest of the target.
const PILL =
  "relative inline-flex h-9 min-w-0 cursor-pointer items-center gap-1.5 rounded-full ps-1.5 pe-3 text-[13px] leading-none font-semibold select-none " +
  "before:absolute before:inset-x-0 before:-inset-y-1 before:content-[''] " +
  "transition-[scale,background-color,color] duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-reduce:transition-none " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.97] motion-reduce:active:scale-100 " +
  "disabled:cursor-default disabled:active:scale-100";

// On its own (glass off): the brand fill for the current step, plain words for the others.
// glass/order-create.css gives the current one the shared selection fill and its glow.
const PILL_STATE: Record<StepState, string> = {
  current: "bg-primary text-primary-foreground forced-colors:bg-[Highlight] forced-colors:text-[HighlightText]",
  done: "text-ink hover:bg-ink/6",
  todo: "text-ink-soft enabled:hover:bg-ink/6",
};
const BEAD_STATE: Record<StepState, string> = {
  current: "bg-primary-foreground text-primary",
  done: "bg-success-soft text-success",
  todo: "bg-paper-sunken text-ink-soft",
};

/**
 * «العميل» → «المنتجات» → «التوصيل والدفع»: three pills joined by a line, always
 * at the top of the sheet. The current step carries the brand fill; a finished
 * one shows a check. A step that has been reached can be pressed to go back to
 * it (or forward again, over steps that are complete) — nothing typed is lost
 * either way. A step not reached yet is not a button to press: the way there
 * is the footer's «التالي».
 */
export function OrderStepper({ ctl }: { ctl: CreateOrder }) {
  const t = useT(CREATE_STRINGS);
  const names: Record<StepIndex, { full: string; short: string }> = {
    0: { full: t.stepCustomer, short: t.stepCustomer },
    1: { full: t.stepProducts, short: t.stepProducts },
    2: { full: t.stepDelivery, short: t.stepDeliveryShort },
  };

  return (
    <nav aria-label={t.stepsLabel} data-slot="order-steps" className="shrink-0 px-4 pb-3 sm:px-5">
      <ol className="flex items-center">
        {ORDER.map((at) => {
          const current = at === ctl.step;
          const state: StepState = current ? "current" : at <= ctl.reached && ctl.stepComplete(at) ? "done" : "todo";
          const name = names[at];
          return (
            <li key={at} className={cn("flex min-w-0 items-center", at > 0 && "flex-1")}>
              {at > 0 && (
                <span
                  aria-hidden
                  data-slot="order-step-line"
                  data-done={at <= ctl.reached ? "" : undefined}
                  className={cn(
                    "mx-1 h-0.5 min-w-2 flex-1 rounded-full transition-[background-color] duration-[var(--dur-move)] ease-[var(--ease-out)] motion-reduce:transition-none",
                    at <= ctl.reached ? "bg-success/60" : "bg-line"
                  )}
                />
              )}
              <button
                type="button"
                data-slot="order-step"
                data-state={state}
                aria-current={current ? "step" : undefined}
                aria-label={fmt(state === "done" ? t.stepDone : t.stepOf, { n: at + 1, total: STEP_COUNT, name: name.full })}
                disabled={at > ctl.reached || ctl.saving}
                onClick={() => ctl.goTo(at)}
                className={cn(PILL, PILL_STATE[state])}
              >
                <span
                  data-slot="order-step-bead"
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full text-xs leading-none font-semibold tabular-nums",
                    BEAD_STATE[state]
                  )}
                >
                  {state === "done" ? (
                    <IconCheck className="size-3.5 motion-safe:animate-[order-create-pop_var(--dur-pop)_var(--ease-pop)_both]" weight="bold" aria-hidden />
                  ) : (
                    fmt(t.stepNumber, { n: at + 1 })
                  )}
                </span>
                {name.short === name.full ? (
                  <span className="min-w-0 truncate">{name.full}</span>
                ) : (
                  <>
                    <span className="min-w-0 truncate sm:hidden">{name.short}</span>
                    <span className="hidden min-w-0 truncate sm:inline">{name.full}</span>
                  </>
                )}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
