import { useId, useRef, useState, type FormEvent } from "react";
import { Alert, Button, Input } from "@store-builder/ui";
import { PICKUP_CODE_LENGTH, isPickupCodeWrong, isPickupStale, pickupCollect } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { isPermissionError } from "@/lib/errors";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatMoney } from "@/lib/format";
import { asciiDigits } from "@/lib/wholeNumber";
import { fmt, useT } from "@/i18n/LocaleContext";
import { Modal } from "@/components/Modal";
import { IconPacked, IconSpinner } from "@/components/icons";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { PICKUP_STRINGS } from "./pickupStrings";

/** What the dialog says about the order being handed over. */
export interface HandOverOrder {
  id: string;
  orderNumber: string;
  customerName?: string | null;
  totalAmount?: string | number | null;
  currency?: string | null;
  /** Paid already, or the customer pays at the counter. Left out when not known. */
  paid?: boolean;
}

/**
 * «تسليم» (handoff 225, orders.manage): the customer is at the counter and
 * shows the 6-digit pickup code; typing it hands the order over (the order
 * becomes delivered). A wrong code says «الكود غلط» and keeps the dialog
 * open; a pickup that changed in the meantime (handed over elsewhere,
 * cancelled) closes it and asks the caller to read the list again.
 */
export function HandOverDialog({
  order,
  onClose,
  onDone,
}: {
  /** The order to hand over; null keeps the dialog closed. */
  order: HandOverOrder | null;
  onClose: () => void;
  /** Handed over, or found to have changed: read the pickups again. */
  onDone: () => void;
}) {
  const t = useT(PICKUP_STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const formId = useId();
  const codeId = useId();
  const hintId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [shownFor, setShownFor] = useState<string | null>(null);
  // The last order shown, so the title stays put while the dialog closes.
  const [last, setLast] = useState<HandOverOrder | null>(order);

  // Each opening starts with an empty code.
  if ((order?.id ?? null) !== shownFor) {
    setShownFor(order?.id ?? null);
    if (order) {
      setLast(order);
      setCode("");
      setProblem(null);
      setFailure(null);
      setBusy(false);
    }
  }
  const shown = order ?? last;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!order || busy) return;
    if (code.length !== PICKUP_CODE_LENGTH) {
      setProblem(fmt(t.codeIncomplete, { n: PICKUP_CODE_LENGTH }));
      input.current?.focus();
      return;
    }
    setBusy(true);
    setProblem(null);
    setFailure(null);
    try {
      await pickupCollect(apiClient, workspaceId, order.id, code);
      toast.success(fmt(t.handedOver, { number: order.orderNumber }));
      onDone();
      onClose();
    } catch (err) {
      if (isPickupCodeWrong(err)) {
        setProblem(t.codeWrong);
        input.current?.focus();
        input.current?.select();
      } else if (isPickupStale(err)) {
        toast.error(t.stale);
        onDone();
        onClose();
      } else {
        setFailure(isPermissionError(err) ? t.noOrderManage : errorMessage(err));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={order !== null}
      onClose={() => {
        if (!busy) onClose();
      }}
      title={fmt(t.handOverTitle, { number: shown?.orderNumber ?? "" })}
      description={fmt(t.handOverBody, { n: PICKUP_CODE_LENGTH })}
      footer={
        <>
          <Button type="button" variant="outline" className="rounded-full px-5" disabled={busy} onClick={onClose}>
            {t.cancel}
          </Button>
          <Button type="submit" form={formId} className="gap-2 rounded-full px-5" disabled={busy} aria-busy={busy || undefined}>
            {busy ? (
              <IconSpinner className="size-4 animate-spin motion-reduce:animate-none" weight="bold" aria-hidden />
            ) : (
              <IconPacked className="size-4" weight="bold" aria-hidden />
            )}
            {busy ? t.handingOver : t.confirmHandOver}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} noValidate className="space-y-4">
        {shown && (shown.customerName || shown.totalAmount != null) && (
          <dl className="zimos-pickup-place space-y-1.5 rounded-2xl bg-paper-sunken px-4 py-3 text-sm">
            {shown.customerName && (
              <div className="flex items-center justify-between gap-3">
                <dt className="text-ink-soft">{t.customer}</dt>
                <dd className="min-w-0 truncate font-medium text-ink">
                  <bdi>{shown.customerName}</bdi>
                </dd>
              </div>
            )}
            {shown.totalAmount != null && (
              <div className="flex items-center justify-between gap-3">
                <dt className="text-ink-soft">{t.total}</dt>
                <dd className="flex items-center gap-2 font-semibold text-ink tabular-nums">
                  <bdi>{formatMoney(shown.totalAmount, shown.currency ?? undefined)}</bdi>
                  {shown.paid !== undefined && (
                    <StatusBadge value={shown.paid ? "paid" : "cod"} tone={shown.paid ? "success" : "warning"} text={shown.paid ? t.paid : t.payOnPickup} />
                  )}
                </dd>
              </div>
            )}
          </dl>
        )}

        <div className="space-y-1.5">
          <label htmlFor={codeId} className="block text-sm font-medium text-ink">
            {t.codeLabel}
          </label>
          <Input
            ref={input}
            id={codeId}
            type="text"
            inputMode="numeric"
            dir="ltr"
            autoComplete="off"
            autoFocus
            maxLength={PICKUP_CODE_LENGTH}
            value={code}
            disabled={busy}
            aria-invalid={problem ? true : undefined}
            aria-describedby={hintId}
            onChange={(e) => {
              setCode(asciiDigits(e.target.value).replace(/\D/g, "").slice(0, PICKUP_CODE_LENGTH));
              setProblem(null);
            }}
            className="h-16 w-full rounded-[1rem] text-center font-mono text-[28px] tracking-[0.4em] tabular-nums md:text-[28px]"
          />
          <p id={hintId} role={problem ? "alert" : undefined} className={problem ? "text-sm font-semibold text-danger" : "text-xs text-ink-soft"}>
            {problem ?? fmt(t.codeIncomplete, { n: PICKUP_CODE_LENGTH })}
          </p>
        </div>

        {failure && <Alert variant="danger">{failure}</Alert>}
      </form>
    </Modal>
  );
}
