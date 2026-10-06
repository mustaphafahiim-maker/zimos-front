import { useState } from "react";
import { Alert, Badge, Button } from "@store-builder/ui";
import {
  manualTransferConfirm,
  manualTransferListForOrder,
  manualTransferReject,
  type ManualTransferPayment,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useAsync } from "@/lib/useAsync";
import { getErrorMessage } from "@/lib/errors";
import { formatDateTime, formatMoney } from "@/lib/format";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { TextField } from "@/components/Field";
import { useToast } from "@/components/Toast";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    title: "Transfer from the customer",
    full: "Full payment",
    deposit: "Deposit",
    waiting: "Waiting for you",
    confirmed: "Confirmed",
    rejected: "Rejected",
    via: "via {method}",
    sender: "Sent from",
    noReceipt: "No receipt uploaded",
    openReceipt: "Open the receipt",
    receiptAlt: "Transfer receipt",
    confirm: "Confirm transfer received",
    reject: "Reject",
    confirmTitle: "Confirm this transfer?",
    confirmFull: "{amount} will be recorded as paid and the order becomes ready to ship.",
    confirmDeposit: "{amount} will be recorded as a deposit; the rest is collected on delivery.",
    rejectTitle: "Reject this transfer?",
    rejectDesc: "The order stays unpaid. You can cancel it or ask the customer to transfer again.",
    reason: "Reason (optional)",
    notifyCustomer: "Tell the customer — they can upload a new receipt from the order link",
    confirmedToast: "Transfer confirmed.",
    rejectedToast: "Transfer rejected.",
    reviewedAt: "Reviewed {date}",
    working: "Working…",
  },
  ar: {
    title: "تحويل من العميل",
    full: "دفع كامل",
    deposit: "عربون",
    waiting: "بانتظار مراجعتك",
    confirmed: "تم التأكيد",
    rejected: "مرفوض",
    via: "عبر {method}",
    sender: "محوَّل من",
    noReceipt: "لم تُرفع صورة إيصال",
    openReceipt: "افتح الإيصال",
    receiptAlt: "إيصال التحويل",
    confirm: "تأكيد استلام التحويل",
    reject: "رفض",
    confirmTitle: "تأكيد هذا التحويل؟",
    confirmFull: "سيُسجَّل {amount} كمدفوع ويصبح الطلب جاهزًا للشحن.",
    confirmDeposit: "سيُسجَّل {amount} كعربون، والباقي يُحصَّل عند التسليم.",
    rejectTitle: "رفض هذا التحويل؟",
    rejectDesc: "يبقى الطلب غير مدفوع. يمكنك إلغاؤه أو طلب تحويل جديد من العميل.",
    reason: "السبب (اختياري)",
    notifyCustomer: "بلّغ العميل — يقدر يرفع إيصال جديد من رابط الطلب",
    confirmedToast: "تم تأكيد التحويل.",
    rejectedToast: "اترفض التحويل.",
    reviewedAt: "روجع في {date}",
    working: "بننفّذ…",
  },
} satisfies Messages;

/**
 * The customer's manual transfers on an order (SPEC §11.3): the receipt, who
 * sent it, and the merchant's "Confirm transfer received" / "Reject".
 * Renders nothing for an order with no transfer.
 */
export function ManualTransfersCard({
  workspaceId,
  orderId,
  canManage = true,
  onChanged,
}: {
  workspaceId: string;
  orderId: string;
  canManage?: boolean;
  onChanged: () => void;
}) {
  const t = useT(STRINGS);
  const toast = useToast();
  const transfers = useAsync(() => manualTransferListForOrder(apiClient, workspaceId, orderId).catch(() => []), [workspaceId, orderId]);
  const [dialog, setDialog] = useState<{ kind: "confirm" | "reject"; transfer: ManualTransferPayment } | null>(null);
  const [reason, setReason] = useState("");
  const [notifyCustomer, setNotifyCustomer] = useState(true);

  const list = transfers.data ?? [];
  if (list.length === 0) return null;

  async function run() {
    if (!dialog) return;
    try {
      if (dialog.kind === "confirm") await manualTransferConfirm(apiClient, workspaceId, orderId, dialog.transfer.id);
      else await manualTransferReject(apiClient, workspaceId, orderId, dialog.transfer.id, reason.trim(), notifyCustomer);
    } catch (err) {
      throw new Error(getErrorMessage(err));
    }
    toast.success(dialog.kind === "confirm" ? t.confirmedToast : t.rejectedToast);
    setDialog(null);
    setReason("");
    await transfers.refresh({ silent: true });
    onChanged();
  }

  return (
    <div className="space-y-3">
      {list.map((transfer) => {
        const waiting = transfer.status === "initialized";
        const money = formatMoney(transfer.amount, transfer.currency);
        return (
          <Alert key={transfer.id} variant={waiting ? "default" : "info"} className="block">
            <div className="flex flex-wrap items-start gap-4">
              {transfer.receipt ? (
                <a href={transfer.receipt.url} target="_blank" rel="noreferrer" className="shrink-0" title={t.openReceipt}>
                  <img
                    src={transfer.receipt.url}
                    alt={t.receiptAlt}
                    className="size-24 rounded-lg border border-line object-cover"
                    loading="lazy"
                  />
                </a>
              ) : (
                <div className="flex size-24 shrink-0 items-center justify-center rounded-lg border border-dashed border-line p-2 text-center text-xs text-ink-soft">
                  {t.noReceipt}
                </div>
              )}
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-ink">{t.title}</span>
                  <Badge variant="secondary">{transfer.purpose === "deposit" ? t.deposit : t.full}</Badge>
                  <Badge variant={waiting ? "default" : transfer.status === "failed" ? "destructive" : "outline"}>
                    {waiting ? t.waiting : transfer.status === "failed" ? t.rejected : t.confirmed}
                  </Badge>
                </div>
                <p className="text-sm text-ink">
                  <bdi dir="ltr" className="tabular-nums font-medium">
                    {money}
                  </bdi>{" "}
                  {transfer.methodName && <span className="text-ink-soft">{fmt(t.via, { method: transfer.methodName })}</span>}
                </p>
                {transfer.senderReference && (
                  <p className="text-sm text-ink-soft">
                    {t.sender}: <bdi dir="ltr">{transfer.senderReference}</bdi>
                  </p>
                )}
                <p className="text-xs text-ink-soft">
                  {transfer.reviewedAt ? fmt(t.reviewedAt, { date: formatDateTime(transfer.reviewedAt) }) : formatDateTime(transfer.createdAt)}
                  {transfer.failureReason ? ` · ${transfer.failureReason}` : ""}
                </p>
                {waiting && canManage && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button className="min-h-11" onClick={() => setDialog({ kind: "confirm", transfer })}>
                      {t.confirm}
                    </Button>
                    <Button variant="outline" className="min-h-11" onClick={() => setDialog({ kind: "reject", transfer })}>
                      {t.reject}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </Alert>
        );
      })}

      <ConfirmDialog
        open={dialog !== null}
        title={dialog?.kind === "reject" ? t.rejectTitle : t.confirmTitle}
        description={
          dialog
            ? dialog.kind === "reject"
              ? t.rejectDesc
              : fmt(dialog.transfer.purpose === "deposit" ? t.confirmDeposit : t.confirmFull, {
                  amount: formatMoney(dialog.transfer.amount, dialog.transfer.currency),
                })
            : undefined
        }
        confirmLabel={dialog?.kind === "reject" ? t.reject : t.confirm}
        busyLabel={t.working}
        destructive={dialog?.kind === "reject"}
        onCancel={() => setDialog(null)}
        onConfirm={run}
      >
        {dialog?.kind === "reject" && (
          <div className="space-y-3">
            <TextField label={t.reason} value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} />
            <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-ink">
              <input type="checkbox" className="size-4 accent-[var(--color-primary)]" checked={notifyCustomer} onChange={(e) => setNotifyCustomer(e.target.checked)} />
              {t.notifyCustomer}
            </label>
          </div>
        )}
      </ConfirmDialog>
    </div>
  );
}
