import { useEffect, useId, useState } from "react";
import { Alert, Button, cn } from "@store-builder/ui";
import { returnCaseOf, returnSourceOf, type ReturnDecisionPayload, type ReturnRequest } from "@store-builder/api-client";
import { MoneyInput } from "@/components/MoneyInput";
import { Sheet } from "@/components/Sheet";
import { Textarea } from "@/components/Textarea";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { useErrorMessage } from "@/lib/errorMessages";
import { majorToMinor } from "@/lib/format";
import { splitReason, useReturnLabels } from "./returnLabels";

const STRINGS = {
  en: {
    approveTitle: "Approve this return?",
    approveExchangeTitle: "Approve this exchange?",
    rejectTitle: "Reject this return?",
    reasonCustomer: "The customer's reason",
    reasonStore: "The reason on the return",
    note: "Message to the customer (optional)",
    notify: "Tell the customer",
    notifyHint: "They get an email and a notification with your decision and message.",
    shipping: "Shipping for the replacement",
    exchangeNote: "A new order is made for the new size; the customer pays only the price difference if the new one costs more",
    final: "A rejection is final: this return can't be approved afterwards, and its pieces don't go back into stock.",
    keep: "Keep it waiting",
    approve: "Approve the return",
    approveExchange: "Approve the exchange",
    reject: "Reject the return",
    working: "Saving…",
    invalidAmount: "Enter a valid amount.",
  },
  ar: {
    approveTitle: "هل توافق على هذا المرتجع؟",
    approveExchangeTitle: "هل توافق على هذا الاستبدال؟",
    rejectTitle: "هل ترفض هذا المرتجع؟",
    reasonCustomer: "سبب العميل",
    reasonStore: "السبب المسجّل على المرتجع",
    note: "رسالة إلى العميل (اختياري)",
    notify: "إبلاغ العميل",
    notifyHint: "يصله بريد إلكتروني وإشعار بقرارك ورسالتك.",
    shipping: "رسوم شحن البديل",
    exchangeNote: "يُنشأ طلب جديد بالمقاس الجديد، ويدفع العميل فرق السعر فقط إذا كان المقاس الجديد أغلى",
    final: "الرفض نهائي: لن يُقبل هذا المرتجع بعد ذلك، ولن تعود قطعه إلى المخزون.",
    keep: "إبقاؤه بانتظار القرار",
    approve: "الموافقة على المرتجع",
    approveExchange: "الموافقة على الاستبدال",
    reject: "رفض المرتجع",
    working: "جارٍ الحفظ…",
    invalidAmount: "أدخل مبلغًا صحيحًا.",
  },
} satisfies Messages;

/** The destructive one is the full danger fill, as in ConfirmDialog: it is the thing being asked about. */
const DANGER_FILL = "bg-danger text-paper-raised hover:bg-danger/90 focus-visible:ring-danger/30 dark:bg-danger dark:hover:bg-danger/90";

const NOTE_MAX = 500;

interface ReturnDecisionSheetProps {
  /** The return being decided. It stays here while the sheet closes, so the sheet does not empty on its way out. */
  ret: ReturnRequest | null;
  action: "approve" | "reject";
  open: boolean;
  /** Who and which order, under the title: «أحمد علي · #1024». */
  who?: string;
  /** The currency of the order, for the replacement's shipping. */
  currency?: string;
  onClose: () => void;
  /** Sends the decision. Resolve to close; throw to stay open with the message. */
  onConfirm: (payload: ReturnDecisionPayload) => Promise<void>;
}

/**
 * Approve or reject a return: the reason it was opened for, a
 * message the shopper reads on their tracking page and in the email, whether
 * to tell them at all, and — for an exchange — what the replacement order
 * charges for shipping. Ticked "Tell the customer" leaves the store's own
 * email switch to decide; unticked sends nothing for this decision.
 */
export function ReturnDecisionSheet({ ret, action, open, who, currency, onClose, onConfirm }: ReturnDecisionSheetProps) {
  const t = useT(STRINGS);
  const labels = useReturnLabels();
  const errorMessage = useErrorMessage();
  const noteId = useId();
  const notifyHintId = useId();
  const [note, setNote] = useState("");
  const [notify, setNotify] = useState(true);
  const [shipping, setShipping] = useState("");
  const [shippingError, setShippingError] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setNote("");
    setNotify(true);
    setShipping("");
    setShippingError(undefined);
    setError(null);
  }, [open, ret?.id, action]);

  if (!ret) return null;
  const { code, detail } = splitReason(ret.reason);
  const exchange = returnCaseOf(ret).resolution === "exchange";
  const approving = action === "approve";

  async function confirm() {
    let exchangeShippingAmount: number | undefined;
    if (approving && exchange && shipping.trim() !== "") {
      const minor = majorToMinor(shipping);
      if (!Number.isFinite(minor) || minor < 0) {
        setShippingError(t.invalidAmount);
        return;
      }
      exchangeShippingAmount = minor;
    }
    setBusy(true);
    setError(null);
    try {
      await onConfirm({
        action,
        ...(note.trim() ? { note: note.trim().slice(0, NOTE_MAX) } : {}),
        ...(notify ? {} : { notifyCustomer: false }),
        ...(exchangeShippingAmount !== undefined ? { exchangeShippingAmount } : {}),
      });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next && !busy) onClose();
      }}
      title={approving ? (exchange ? t.approveExchangeTitle : t.approveTitle) : t.rejectTitle}
      description={who}
      size="sm"
      footer={
        <>
          <Button type="button" variant="outline" className="rounded-full px-5" disabled={busy} onClick={onClose}>
            {t.keep}
          </Button>
          <Button
            type="button"
            variant={approving ? "default" : "danger"}
            data-fill={approving ? undefined : "danger"}
            className={cn("rounded-full px-5", !approving && DANGER_FILL)}
            disabled={busy}
            onClick={() => void confirm()}
          >
            {busy ? t.working : approving ? (exchange ? t.approveExchange : t.approve) : t.reject}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <Alert variant="danger">{error}</Alert>}
        <div data-slot="return-note" className="rounded-2xl bg-paper-sunken px-4 py-3">
          <p className="text-xs leading-4 font-medium text-ink-soft">{returnSourceOf(ret) === "shopper" ? t.reasonCustomer : t.reasonStore}</p>
          <p className="mt-1 text-[15px] leading-6 font-semibold text-ink">{labels.reason(code)}</p>
          {detail && (
            <p dir="auto" className="mt-1 text-sm leading-6 wrap-anywhere text-ink">
              {detail}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <label htmlFor={noteId} className="block text-sm font-medium text-ink">
            {t.note}
          </label>
          <Textarea id={noteId} value={note} maxLength={NOTE_MAX} dir="auto" rows={3} disabled={busy} onChange={(e) => setNote(e.target.value)} />
        </div>

        {approving && exchange && (
          <div className="space-y-1.5">
            <MoneyInput
              label={t.shipping}
              value={shipping}
              onChange={(next) => {
                setShipping(next);
                setShippingError(undefined);
              }}
              currency={currency}
              placeholder="0"
              error={shippingError}
              disabled={busy}
            />
            <p className="text-xs leading-5 text-ink-soft">{t.exchangeNote}</p>
          </div>
        )}

        <div>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium text-ink">
            <input
              type="checkbox"
              className="size-5 shrink-0 cursor-pointer accent-primary"
              checked={notify}
              disabled={busy}
              aria-describedby={notifyHintId}
              onChange={(e) => setNotify(e.target.checked)}
            />
            {t.notify}
          </label>
          <p id={notifyHintId} className="text-xs leading-5 text-ink-soft">
            {t.notifyHint}
          </p>
        </div>

        {!approving && <p className="text-sm leading-6 text-ink-soft">{t.final}</p>}
      </div>
    </Sheet>
  );
}
