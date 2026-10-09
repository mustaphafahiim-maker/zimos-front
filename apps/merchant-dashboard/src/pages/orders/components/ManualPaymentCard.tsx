import { useState } from "react";
import { Alert, Button } from "@store-builder/ui";
import {
  isApiErrorCode,
  manualPaymentApprove,
  manualPaymentForOrder,
  manualPaymentOfOrder,
  manualPaymentReject,
  type ManualPaymentReview,
  type ManualPaymentStatus,
} from "@store-builder/api-client";
import { IconExternal } from "@/components/icons";
import { apiClient } from "@/lib/apiClient";
import { useAsync } from "@/lib/useAsync";
import { getErrorMessage } from "@/lib/errors";
import { canManageOrderFulfilment } from "@/lib/fulfilmentAccess";
import { formatDateTime, formatMoney } from "@/lib/format";
import { useWorkspace } from "@/context/WorkspaceContext";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Field } from "@/components/Field";
import { Modal } from "@/components/Modal";
import { StatusBadge } from "@/components/StatusBadge";
import { Textarea } from "@/components/Textarea";
import { useToast } from "@/components/Toast";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    title: "Paid by InstaPay / wallet",
    short: "InstaPay / wallet — {status}",
    kind_instapay: "InstaPay",
    kind_wallet: "Wallet",
    status_awaiting_proof: "Waiting for the screenshot",
    status_submitted: "Waiting for review",
    status_approved: "Approved",
    status_rejected: "Rejected",
    paidTo: "Paid to",
    paidFrom: "Paid from",
    sent: "Sent",
    reviewed: "Reviewed",
    noProof: "No screenshot yet",
    proofAlt: "Transfer screenshot",
    enlarge: "Enlarge the screenshot",
    openLink: "Payment link",
    approve: "Approve payment",
    approveTitle: "Approve this payment?",
    approveBody: "The order will be marked paid in full {total}",
    reject: "Reject",
    rejectTitle: "Reject this payment proof?",
    reason: "Reason (the shopper sees it)",
    reasonMissing: "Write the reason — the shopper sees it.",
    rejectedReason: "Reason: {rejectionReason}",
    canResend: "The shopper can send another screenshot",
    approved: "Payment approved.",
    rejected: "Payment proof rejected.",
    working: "Working…",
    notSubmitted: "There's no screenshot waiting for review",
    cancelled: "This order is cancelled",
    approveFirst: "Approve the payment first",
  },
  ar: {
    title: "الدفع بإنستا باي / محفظة",
    short: "إنستا باي / محفظة — {status}",
    kind_instapay: "إنستا باي",
    kind_wallet: "محفظة",
    status_awaiting_proof: "مستني صورة التحويل",
    status_submitted: "مستني المراجعة",
    status_approved: "اتقبل",
    status_rejected: "اترفض",
    paidTo: "حوّل على",
    paidFrom: "حوّل من",
    sent: "اتبعت",
    reviewed: "اتراجع",
    noProof: "لسه مفيش صورة تحويل",
    proofAlt: "صورة التحويل",
    enlarge: "كبّر صورة التحويل",
    openLink: "لينك الدفع",
    approve: "قبول الدفع",
    approveTitle: "تقبل الدفع ده؟",
    approveBody: "هيتسجل الطلب مدفوع بالكامل {total}",
    reject: "رفض",
    rejectTitle: "ترفض إثبات الدفع ده؟",
    reason: "سبب الرفض (هيظهر للعميل)",
    reasonMissing: "اكتب سبب الرفض — العميل هيشوفه.",
    rejectedReason: "سبب الرفض: {rejectionReason}",
    canResend: "العميل يقدر يبعت صورة تانية",
    approved: "الدفع اتقبل.",
    rejected: "إثبات الدفع اترفض.",
    working: "بننفّذ…",
    notSubmitted: "مفيش صورة تحويل مستنية المراجعة",
    cancelled: "الطلب ده اتلغى",
    approveFirst: "لازم تقبل الدفع الأول",
  },
} satisfies Messages;

const TONE: Record<ManualPaymentStatus, "neutral" | "info" | "success" | "warning" | "danger"> = {
  awaiting_proof: "neutral",
  submitted: "warning",
  approved: "success",
  rejected: "danger",
};

/**
 * «الدفع بإنستا باي / محفظة» on the order's payment card (handoff 340): the
 * method and number the shopper paid to, where it stands, the number they
 * paid from and the screenshot (a tap enlarges it), and — for a proof waiting
 * for review, with orders.manage — «قبول الدفع» and «رفض» with its reason.
 * Renders nothing for an order not paid this way.
 */
export function ManualPaymentCard({
  workspaceId,
  order,
  onChanged,
}: {
  workspaceId: string;
  order: { id: string; totalAmount: number | string; currency: string; paymentMethod?: string | null; updatedAt?: string };
  onChanged: () => void;
}) {
  const t = useT(STRINGS);
  const toast = useToast();
  const { currentWorkspace } = useWorkspace();
  const canManage = canManageOrderFulfilment(currentWorkspace?.role);
  const isTransfer = order.paymentMethod === "bank_transfer";
  // Its own read, not the order's copy: the screenshot's link is signed for a short while, so a fresh one each time.
  const payment = useAsync(
    () => (isTransfer ? manualPaymentForOrder(apiClient, workspaceId, order.id).catch(() => manualPaymentOfOrder(order)) : Promise.resolve(null)),
    [workspaceId, order.id, isTransfer, order.updatedAt]
  );
  const [dialog, setDialog] = useState<"approve" | "reject" | null>(null);
  const [zoom, setZoom] = useState(false);
  const [reason, setReason] = useState("");

  const data: ManualPaymentReview | null = payment.data ?? (isTransfer ? manualPaymentOfOrder(order) : null);
  if (!data) return null;

  async function run() {
    try {
      const next = dialog === "approve" ? await manualPaymentApprove(apiClient, workspaceId, order.id) : await rejectWithReason();
      payment.setData(next);
    } catch (err) {
      if (isApiErrorCode(err, "MANUAL_PAYMENT_NOT_SUBMITTED")) {
        // Someone else reviewed it, or the shopper has not sent it: show what is true now.
        void payment.refresh({ silent: true });
        throw new Error(t.notSubmitted);
      }
      if (isApiErrorCode(err, "ORDER_CANCELLED")) throw new Error(t.cancelled);
      // A sentence of our own (the missing reason) passes through as it is.
      throw new Error(getErrorMessage(err));
    }
    toast.success(dialog === "approve" ? t.approved : t.rejected);
    setDialog(null);
    setReason("");
    onChanged();
  }

  async function rejectWithReason(): Promise<ManualPaymentReview> {
    const text = reason.trim();
    if (!text) throw new Error(t.reasonMissing);
    return manualPaymentReject(apiClient, workspaceId, order.id, text);
  }

  return (
    <Alert data-manual-payment={data.status} variant={data.awaitingReview ? "default" : "info"} className="block">
      <div className="flex flex-wrap items-start gap-4">
        {data.proofUrl ? (
          <button
            type="button"
            onClick={() => setZoom(true)}
            aria-label={t.enlarge}
            title={t.enlarge}
            className="shrink-0 cursor-zoom-in rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <img src={data.proofUrl} alt={t.proofAlt} className="size-24 rounded-lg border border-line object-cover" loading="lazy" />
          </button>
        ) : (
          <div className="flex size-24 shrink-0 items-center justify-center rounded-lg border border-dashed border-line p-2 text-center text-xs text-ink-soft">
            {t.noProof}
          </div>
        )}
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-ink">{t.title}</span>
            <StatusBadge value={data.status} tone={TONE[data.status] ?? "neutral"} text={t[`status_${data.status}`] ?? data.status} />
          </div>
          <p className="text-sm text-ink">
            <span className="text-ink-soft">{t.paidTo}: </span>
            <span dir="auto">{data.label}</span> ·{" "}
            <bdi dir="ltr" className="tabular-nums font-medium">
              {data.accountNumber}
            </bdi>
            {data.paymentLink && (
              <>
                {" · "}
                <a href={data.paymentLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                  {t.openLink}
                  <IconExternal className="size-3.5 rtl:-scale-x-100" aria-hidden />
                </a>
              </>
            )}
          </p>
          {data.payerNumber && (
            <p className="text-sm text-ink-soft">
              {t.paidFrom}:{" "}
              <bdi dir="ltr" className="tabular-nums text-ink">
                {data.payerNumber}
              </bdi>
            </p>
          )}
          {(data.submittedAt || data.reviewedAt) && (
            <p className="text-xs text-ink-soft">
              {data.submittedAt && `${t.sent}: ${formatDateTime(data.submittedAt)}`}
              {data.submittedAt && data.reviewedAt && " · "}
              {data.reviewedAt && `${t.reviewed}: ${formatDateTime(data.reviewedAt)}`}
            </p>
          )}
          {data.status === "rejected" && (
            <p className="text-sm text-ink">
              {data.rejectionReason && <span dir="auto">{fmt(t.rejectedReason, { rejectionReason: data.rejectionReason })}</span>}
              <span className="block text-xs text-ink-soft">{t.canResend}</span>
            </p>
          )}
          {data.awaitingReview && canManage && (
            <div className="flex flex-wrap gap-2 pt-1">
              <Button className="min-h-11" onClick={() => setDialog("approve")}>
                {t.approve}
              </Button>
              <Button variant="outline" className="min-h-11" onClick={() => setDialog("reject")}>
                {t.reject}
              </Button>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={dialog !== null}
        title={dialog === "reject" ? t.rejectTitle : t.approveTitle}
        description={dialog === "approve" ? fmt(t.approveBody, { total: formatMoney(order.totalAmount, order.currency) }) : undefined}
        confirmLabel={dialog === "reject" ? t.reject : t.approve}
        busyLabel={t.working}
        destructive={dialog === "reject"}
        onCancel={() => setDialog(null)}
        onConfirm={run}
      >
        {dialog === "reject" && (
          <Field label={t.reason} required>
            {({ id }) => <Textarea id={id} rows={3} dir="auto" value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} />}
          </Field>
        )}
      </ConfirmDialog>

      {data.proofUrl && (
        <Modal open={zoom} onClose={() => setZoom(false)} title={t.proofAlt}>
          <div className="p-4">
            <img src={data.proofUrl} alt={t.proofAlt} className="mx-auto max-h-[75vh] w-auto max-w-full rounded-lg" />
          </div>
        </Modal>
      )}
    </Alert>
  );
}

/**
 * «إنستا باي / محفظة — {status}» with the screenshot's thumbnail, for a row of
 * the confirmation queue: such an order can't be confirmed until its payment
 * is approved. Nothing for any other order.
 */
export function ManualPaymentBadge({ order }: { order: unknown }) {
  const t = useT(STRINGS);
  const data = manualPaymentOfOrder(order);
  if (!data) return null;
  return (
    <span data-manual-payment={data.status} className="inline-flex items-center gap-1.5">
      {data.proofUrl && <img src={data.proofUrl} alt={t.proofAlt} className="size-7 rounded-md border border-line object-cover" loading="lazy" />}
      <StatusBadge value={data.status} tone={TONE[data.status] ?? "neutral"} text={fmt(t.short, { status: t[`status_${data.status}`] ?? data.status })} />
    </span>
  );
}

/** Whether an order's manual payment still blocks confirming it («لازم تقبل الدفع الأول»). */
export function useManualPaymentGate(order: unknown): string | null {
  const t = useT(STRINGS);
  const data = manualPaymentOfOrder(order);
  return data && data.status !== "approved" ? t.approveFirst : null;
}
