import { IconDraft, IconUndo } from "@/components/icons";
import { useT } from "@/i18n/LocaleContext";
import { CREATE_STRINGS } from "./strings";
import type { CreateOrder } from "./useCreateOrder";

const STRIP =
  "mb-4 flex min-h-11 flex-wrap items-center justify-between gap-x-2 rounded-[0.875rem] bg-primary-soft ps-3.5 pe-1 text-sm leading-5 text-ink " +
  "motion-safe:animate-[order-create-open_var(--dur-fade)_var(--ease-out)_both]";
const ACTION =
  "inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-primary-dark underline-offset-4 " +
  "hover:underline focus-visible:outline-2 focus-visible:outline-primary";

/**
 * The strip over the form when the sheet opens on a kept draft: «كمّلنا من آخر
 * مرة — امسح المسودة». Clearing empties the form at once and, until something
 * is typed, offers the draft back. It goes away by itself once the merchant
 * moves on to another step.
 */
export function DraftStrip({ ctl }: { ctl: CreateOrder }) {
  const t = useT(CREATE_STRINGS);

  if (ctl.notice === "restored") {
    return (
      <div role="status" data-slot="order-draft" className={STRIP}>
        <span className="flex min-w-0 items-center gap-2 py-2">
          <IconDraft className="size-4 shrink-0 text-primary" aria-hidden />
          {t.draftRestored}
        </span>
        <button type="button" onClick={ctl.clearDraftNow} className={ACTION}>
          {t.draftClear}
        </button>
      </div>
    );
  }

  if (ctl.notice === "cleared") {
    return (
      <div role="status" data-slot="order-draft" className={STRIP}>
        <span className="min-w-0 py-2">{t.draftCleared}</span>
        {ctl.canUndoClear && (
          <button type="button" onClick={ctl.undoClear} className={ACTION}>
            <IconUndo className="size-4 shrink-0" aria-hidden />
            {t.draftUndo}
          </button>
        )}
      </div>
    );
  }

  return null;
}
