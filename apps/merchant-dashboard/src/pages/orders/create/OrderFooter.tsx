import { useId } from "react";
import { Alert, Button, cn } from "@store-builder/ui";
import { IconArrowRight } from "@/components/icons";
import { SkeletonBar } from "@/components/DataState";
import { fmt, useT } from "@/i18n/LocaleContext";
import { formatMoney } from "@/lib/format";
import { countOf } from "@/lib/plural";
import { CREATE_STRINGS } from "./strings";
import type { CreateOrder } from "./useCreateOrder";

interface OrderFooterProps {
  ctl: CreateOrder;
  /** The id of the one button, so focus can be handed back to it. */
  primaryId: string;
  /** The sheet was asked to close with something typed: the footer becomes the question. */
  asking: boolean;
  onKeep: () => void;
  onLeave: () => void;
}

/**
 * The foot of the sheet, the same on every step: «الإجمالي» as the server last
 * priced the order, a quiet line under it (pieces, shipping, a discount), and
 * the one button — «التالي», then «أنشئ الأوردر». The button is never switched
 * off for a missing field: pressing it says what is missing, under that field.
 *
 * While a new price is on its way the last total stays where it is, dimmed,
 * with a bar of light under it; the first time there is no total yet, a bar
 * stands in for the figure. Nothing changes height.
 *
 * Asked to close with something typed, the same space holds the question
 * instead — the draft is kept either way.
 */
export function OrderFooter({ ctl, primaryId, asking, onKeep, onLeave }: OrderFooterProps) {
  const t = useT(CREATE_STRINGS);
  const askId = useId();

  if (asking) {
    return (
      <div
        role="group"
        aria-labelledby={askId}
        data-slot="order-close-ask"
        className="flex w-full flex-col gap-3 motion-safe:animate-[order-create-open_var(--dur-fade)_var(--ease-out)_both] sm:flex-row sm:items-center sm:justify-between"
      >
        <p id={askId} className="min-w-0 text-sm leading-6 font-medium text-ink">
          {t.closeAsk}
        </p>
        {/* On the phone the way on is the top row, as in every sheet. */}
        <div className="flex shrink-0 flex-col-reverse gap-2 sm:flex-row sm:gap-3">
          <Button type="button" variant="outline" className="min-h-11 rounded-full px-5" onClick={onLeave}>
            {t.closeYes}
          </Button>
          <Button type="button" autoFocus className="min-h-11 rounded-full px-5" onClick={onKeep}>
            {t.closeNo}
          </Button>
        </div>
      </div>
    );
  }

  const { preview, pricing, currency } = ctl;
  const { lines } = ctl.form;
  const empty = lines.length === 0;
  const pieces = lines.reduce((sum, line) => sum + line.quantity, 0);
  const total = !empty && preview ? formatMoney(preview.totalAmount, currency) : null;

  const quiet: string[] = [];
  let failed = false;
  if (empty) {
    quiet.push(t.addToSee);
  } else if (preview) {
    quiet.push(countOf("piece", pieces));
    quiet.push(fmt(t.shippingLine, { amount: formatMoney(preview.shippingAmount, currency) }));
    if (Number(preview.discountAmount) > 0) quiet.push(fmt(t.discountLine, { amount: formatMoney(preview.discountAmount, currency) }));
  } else if (ctl.previewError) {
    failed = true;
    quiet.push(t.totalFailed);
  } else {
    quiet.push(t.pricing);
  }

  return (
    <>
      {ctl.formError && (
        <Alert variant="danger" role="alert" className="w-full sm:basis-full">
          {ctl.formError}
        </Alert>
      )}

      <div data-slot="order-total" aria-live="polite" aria-busy={pricing || undefined} className="min-w-0 sm:flex-1">
        <div className="flex items-center justify-between gap-3 sm:justify-start">
          <span className="text-sm leading-7 font-medium text-ink-soft">{t.total}</span>
          <span
            data-part="value"
            className="relative flex h-7 min-w-16 items-center justify-end text-[22px] leading-7 font-semibold tracking-tight whitespace-nowrap text-ink tabular-nums sm:justify-start"
          >
            {total !== null ? (
              <bdi className={cn("transition-opacity duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-reduce:transition-none", pricing && "opacity-60")}>
                {total}
              </bdi>
            ) : !empty && pricing ? (
              <SkeletonBar className="h-5 w-28" />
            ) : (
              <span className="text-ink-soft">—</span>
            )}
            {total !== null && pricing && <SkeletonBar className="zimos-oc-pricing absolute inset-x-0 -bottom-0.5 h-[3px]" />}
          </span>
        </div>
        <p
          data-part="quiet"
          data-tone={failed ? "danger" : undefined}
          className={cn("flex h-5 items-center gap-1.5 overflow-hidden text-xs leading-5 whitespace-nowrap tabular-nums", failed ? "text-danger" : "text-ink-soft")}
        >
          {quiet.map((part, index) => (
            <span key={index} className={cn("flex min-w-0 items-center gap-1.5", index === quiet.length - 1 ? "shrink" : "shrink-0")}>
              {index > 0 && <span aria-hidden>·</span>}
              <bdi className="block min-w-0 truncate">{part}</bdi>
            </span>
          ))}
        </p>
      </div>

      <Button
        id={primaryId}
        type="button"
        onClick={() => ctl.next()}
        disabled={ctl.saving}
        className="h-12 w-full rounded-full px-6 text-[15px] sm:h-11 sm:w-auto sm:min-w-40"
      >
        {ctl.saving ? (
          t.creating
        ) : ctl.step === 2 ? (
          t.create
        ) : (
          <>
            {t.next}
            <IconArrowRight className="size-4 rtl:rotate-180" weight="bold" aria-hidden />
          </>
        )}
      </Button>
    </>
  );
}
