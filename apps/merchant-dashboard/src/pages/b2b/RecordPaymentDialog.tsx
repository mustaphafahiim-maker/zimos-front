import { useId, useState, type FormEvent } from "react";
import { Alert, Button } from "@store-builder/ui";
import {
  ON_ACCOUNT_LIMITS,
  apiFieldProblems,
  onAccountPaymentRecord,
  type OnAccountPaymentResult,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatMoney, majorToMinor, minorToMajorInput, parseMoney } from "@/lib/format";
import { fmt, useT } from "@/i18n/LocaleContext";
import { Modal } from "@/components/Modal";
import { MoneyInput } from "@/components/MoneyInput";
import { TextField } from "@/components/Field";
import { useToast } from "@/components/Toast";
import { toAsciiDigits } from "@/pages/loyalty/loyaltyStrings";
import { B2B_STRINGS } from "./b2bStrings";

/** The on-account order a payment is recorded on. */
export interface RecordPaymentTarget {
  orderId: string;
  orderNumber: string;
  /** What is still to pay, minor units. */
  due: number | string;
  currency: string;
}

/**
 * «سجّل دفعة» (handoff 229): a payment that arrived for an on-account order —
 * a bank transfer, a cheque — with the amount (at most what is left) and an
 * optional reference. POST /account-credit/orders/:orderId/payments
 * (orders.manage); the order turns partially paid, or paid.
 */
export function RecordPaymentDialog({
  target,
  onClose,
  onRecorded,
  onStale,
}: {
  /** null while closed. */
  target: RecordPaymentTarget | null;
  onClose: () => void;
  /** After the payment is saved: read the statement or the order again. */
  onRecorded: (result: OnAccountPaymentResult) => void | Promise<void>;
  /** The server says less is left than this dialog showed: read the amounts again. */
  onStale?: () => void | Promise<void>;
}) {
  const t = useT(B2B_STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const formId = useId();
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [amountError, setAmountError] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // The dialog keeps its last order while it closes; each opening starts on the whole amount left.
  const [shown, setShown] = useState<RecordPaymentTarget | null>(target);
  const [openedFor, setOpenedFor] = useState<string | null>(null);
  const targetId = target?.orderId ?? null;
  if (targetId !== openedFor) {
    setOpenedFor(targetId);
    if (target) {
      setShown(target);
      setAmount(minorToMajorInput(target.due));
      setReference("");
      setAmountError(null);
      setFailure(null);
    }
  }
  // The same order with fresh amounts (after `onStale`): the limit follows them.
  const current = target ?? shown;
  const due = current ? parseMoney(current.due) : 0;
  const currency = current?.currency ?? "EGP";
  const money = (n: number | string) => formatMoney(n, currency);

  const minor = majorToMinor(toAsciiDigits(amount));
  const valid = Number.isFinite(minor) && minor >= 1 && minor <= due;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving || !current) return;
    if (!valid) {
      setAmountError(fmt(t.amountError, { max: money(due) }));
      return;
    }
    setSaving(true);
    setFailure(null);
    setAmountError(null);
    try {
      const result = await onAccountPaymentRecord(apiClient, workspaceId, current.orderId, {
        amount: minor,
        ...(reference.trim() ? { reference: reference.trim() } : {}),
      });
      await onRecorded(result);
      onClose();
      const left = parseMoney(result.due);
      toast.success(left > 0 ? fmt(t.recorded, { amount: money(minor), due: money(left) }) : fmt(t.recordedPaid, { amount: money(minor) }));
    } catch (err) {
      if (apiFieldProblems(err).some((p) => p.field === "amount")) {
        // Someone recorded a payment meanwhile: less is left than this dialog showed.
        await onStale?.();
        setAmountError(t.amountTooMuch);
      } else {
        setFailure(errorMessage(err, { NOT_ON_ACCOUNT: t.notOnAccount, ORDER_CANCELLED: t.orderCancelled }));
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={target !== null}
      onClose={onClose}
      title={t.recordTitle}
      description={current ? fmt(t.recordDescription, { number: current.orderNumber, due: money(due) }) : undefined}
      footer={
        <>
          <Button type="button" variant="outline" className="min-h-11" disabled={saving} onClick={onClose}>
            {t.cancel}
          </Button>
          <Button type="submit" form={formId} className="min-h-11" disabled={saving}>
            {saving ? t.recordSaving : t.recordSave}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} noValidate className="space-y-4">
        <MoneyInput
          label={t.amount}
          required
          currency={currency}
          value={amount}
          onChange={(v) => {
            setAmount(v);
            setAmountError(null);
          }}
          error={amountError ?? undefined}
          hint={fmt(t.amountHint, { max: money(due) })}
        />
        <TextField
          label={t.reference}
          hint={t.referenceHint}
          dir="auto"
          autoComplete="off"
          maxLength={ON_ACCOUNT_LIMITS.referenceMax}
          value={reference}
          onChange={(e) => setReference(e.target.value)}
        />
        {failure && <Alert variant="danger">{failure}</Alert>}
      </form>
    </Modal>
  );
}
