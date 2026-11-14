import { useId, useState, type FormEvent } from "react";
import { Alert, Button, Card, CardContent } from "@store-builder/ui";
import { approveManualPayment, rejectManualPayment, type OrderManualPayment } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatDateTime } from "@/lib/format";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { useToast } from "@/components/Toast";
import { StatusBadge } from "@/components/StatusBadge";
import { Modal } from "@/components/Modal";
import { Textarea } from "@/components/Textarea";

const STRINGS = {
  en: {
    title: "Payment proof",
    method: "Paid to",
    payer: "Number paid from",
    submitted: "Sent",
    screenshot: "Payment screenshot",
    open: "Open the screenshot",
    noProof: "The customer hasn't sent the payment proof yet.",
    awaitingReview: "Payment awaiting review: approve it before confirming the order for shipping.",
    approve: "Approve payment",
    reject: "Reject",
    rejectTitle: "Reject this payment proof",
    rejectReason: "Reason (the customer sees it)",
    rejectConfirm: "Reject proof",
    cancel: "Cancel",
    working: "Working…",
    approved: "Payment approved. The order is marked paid.",
    rejected: "Payment proof rejected.",
    reasonRequired: "Enter a reason.",
    status_awaiting_proof: "Waiting for proof",
    status_submitted: "Awaiting review",
    status_approved: "Approved",
    status_rejected: "Rejected",
    rejectedBecause: "Rejected: {reason}",
    close: "Close",
  },
  ar: {
    title: "إثبات الدفع",
    method: "مدفوع إلى",
    payer: "الرقم المحوَّل منه",
    submitted: "أُرسل",
    screenshot: "صورة التحويل",
    open: "فتح صورة التحويل",
    noProof: "لم يرسل العميل إثبات الدفع بعد.",
    awaitingReview: "دفع بانتظار المراجعة: وافق عليه قبل تأكيد الطلب للشحن.",
    approve: "الموافقة على الدفع",
    reject: "رفض",
    rejectTitle: "رفض إثبات الدفع",
    rejectReason: "السبب (يظهر للعميل)",
    rejectConfirm: "رفض الإثبات",
    cancel: "إلغاء",
    working: "جارٍ التنفيذ…",
    approved: "تمت الموافقة على الدفع، والطلب الآن مدفوع.",
    rejected: "تم رفض إثبات الدفع.",
    reasonRequired: "أدخل السبب.",
    status_awaiting_proof: "بانتظار الإثبات",
    status_submitted: "بانتظار المراجعة",
    status_approved: "مقبول",
    status_rejected: "مرفوض",
    rejectedBecause: "مرفوض: {reason}",
    close: "إغلاق",
  },
} satisfies Messages;

const TONE = { awaiting_proof: "neutral", submitted: "warning", approved: "success", rejected: "danger" } as const;

/**
 * An order paid by InstaPay / a wallet: the customer's number and screenshot,
 * and approve / reject while a proof waits. `compact` is the confirmation
 * queue's row (no card frame, a smaller thumbnail).
 */
export function ManualPaymentProof({
  workspaceId,
  orderId,
  payment,
  onChanged,
  compact = false,
}: {
  workspaceId: string;
  orderId: string;
  payment: OrderManualPayment;
  /** Called with the payment as the server now has it. */
  onChanged: (next: OrderManualPayment) => void;
  compact?: boolean;
}) {
  const t = useT(STRINGS);
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const reasonId = useId();
  const [enlarged, setEnlarged] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function approve() {
    setBusy(true);
    try {
      const next = await approveManualPayment(apiClient, workspaceId, orderId);
      toast.success(t.approved);
      onChanged(next);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function reject(e: FormEvent) {
    e.preventDefault();
    if (!reason.trim()) return setError(t.reasonRequired);
    setBusy(true);
    setError(null);
    try {
      const next = await rejectManualPayment(apiClient, workspaceId, orderId, reason.trim());
      toast.success(t.rejected);
      setRejecting(false);
      setReason("");
      onChanged(next);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const statusText = t[`status_${payment.status}` as const];
  const body = (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {!compact && <h2 className="font-display text-base font-medium text-ink">{t.title}</h2>}
        <StatusBadge value={payment.status} tone={TONE[payment.status]} text={statusText} />
      </div>
      {payment.awaitingReview && <Alert>{t.awaitingReview}</Alert>}
      <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
        <dt className="text-ink-soft">{t.method}</dt>
        <dd className="text-ink">
          {payment.label} ·{" "}
          <span className="font-mono" dir="ltr">
            {payment.accountNumber}
          </span>
        </dd>
        {payment.payerNumber && (
          <>
            <dt className="text-ink-soft">{t.payer}</dt>
            <dd className="font-mono text-ink" dir="ltr">
              {payment.payerNumber}
            </dd>
          </>
        )}
        {payment.submittedAt && (
          <>
            <dt className="text-ink-soft">{t.submitted}</dt>
            <dd className="text-ink">{formatDateTime(payment.submittedAt)}</dd>
          </>
        )}
      </dl>
      {payment.status === "rejected" && payment.rejectionReason && (
        <p className="text-sm text-ink-soft">{t.rejectedBecause.replace("{reason}", payment.rejectionReason)}</p>
      )}
      {payment.proofUrl ? (
        <button
          type="button"
          onClick={() => setEnlarged(true)}
          className="block overflow-hidden rounded-[0.5rem] border border-line"
          aria-label={t.open}
        >
          <img src={payment.proofUrl} alt={t.screenshot} className={compact ? "h-20 w-auto object-cover" : "h-40 w-auto object-cover"} />
        </button>
      ) : (
        payment.status === "awaiting_proof" && <p className="text-sm text-ink-soft">{t.noProof}</p>
      )}
      {payment.status === "submitted" && (
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={() => void approve()} disabled={busy}>
            {busy ? t.working : t.approve}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setRejecting(true)} disabled={busy}>
            {t.reject}
          </Button>
        </div>
      )}
      <Modal open={enlarged} onClose={() => setEnlarged(false)} title={t.screenshot}>
        {payment.proofUrl && <img src={payment.proofUrl} alt={t.screenshot} className="mx-auto max-h-[75vh] w-auto" />}
        <div className="mt-3 flex justify-end">
          <Button type="button" variant="outline" onClick={() => setEnlarged(false)}>
            {t.close}
          </Button>
        </div>
      </Modal>
      <Modal open={rejecting} onClose={() => setRejecting(false)} title={t.rejectTitle}>
        <form onSubmit={reject} className="space-y-3">
          <label htmlFor={reasonId} className="text-sm font-medium text-ink">
            {t.rejectReason}
          </label>
          <Textarea id={reasonId} value={reason} maxLength={500} rows={3} onChange={(e) => setReason(e.target.value)} />
          {error && <Alert variant="destructive">{error}</Alert>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setRejecting(false)} disabled={busy}>
              {t.cancel}
            </Button>
            <Button type="submit" variant="destructive" disabled={busy}>
              {busy ? t.working : t.rejectConfirm}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );

  if (compact) return body;
  return (
    <Card>
      <CardContent className="py-4">{body}</CardContent>
    </Card>
  );
}
