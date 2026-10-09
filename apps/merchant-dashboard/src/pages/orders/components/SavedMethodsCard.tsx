import { useState } from "react";
import { IconCard, IconDelete } from "@/components/icons";
import { Badge, Button } from "@store-builder/ui";
import {
  savedMethodsCharge,
  savedMethodsDelete,
  savedMethodsForOrder,
  savedMethodsSave,
  type SavedMethod,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useAsync } from "@/lib/useAsync";
import { getErrorMessage } from "@/lib/errors";
import { formatDate, formatMoney } from "@/lib/format";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { savedMethodChargeProblem, savedMethodPlainName } from "./savedMethodText";

const STRINGS = {
  en: {
    title: "Saved cards",
    save: "Save this card for the customer",
    saving: "Saving…",
    savedToast: "Card saved.",
    card: "{brand} ending {last4}",
    expires: "expires {date}",
    expired: "Expired",
    charge: "Charge {amount}",
    chargeTitle: "Charge the saved card?",
    chargeDesc: "{amount} will be taken from {card} and the order marked as paid.",
    chargedToast: "Card charged — the order is paid.",
    remove: "Forget this card",
    removeTitle: "Forget this card?",
    removeDesc: "It can no longer be charged. The customer can pay again to save it.",
    removedToast: "Card removed.",
    working: "Working…",
  },
  ar: {
    title: "البطاقات المحفوظة",
    save: "احفظ هذه البطاقة للعميل",
    saving: "بنحفظ…",
    savedToast: "تم حفظ البطاقة.",
    card: "{brand} تنتهي بـ {last4}",
    expires: "تنتهي {date}",
    expired: "منتهية",
    charge: "اخصم {amount}",
    chargeTitle: "الخصم من البطاقة المحفوظة؟",
    chargeDesc: "سيُخصم {amount} من {card} ويُسجَّل الطلب كمدفوع.",
    chargedToast: "تم الخصم — الطلب مدفوع.",
    remove: "انسَ هذه البطاقة",
    removeTitle: "نسيان هذه البطاقة؟",
    removeDesc: "لن يمكن الخصم منها بعد ذلك. يستطيع العميل الدفع مرة أخرى لحفظها.",
    removedToast: "تم حذف البطاقة.",
    working: "بننفّذ…",
  },
} satisfies Messages;

/**
 * Saved payment methods on an order (SPEC §11.6): save the card behind a paid
 * payment, charge a saved card for what the order still owes, forget a card.
 * Renders nothing when the gateway cannot save cards and the customer has none.
 */
export function SavedMethodsCard({
  workspaceId,
  orderId,
  currency,
  onChanged,
}: {
  workspaceId: string;
  orderId: string;
  currency: string;
  onChanged: () => void;
}) {
  const t = useT(STRINGS);
  const toast = useToast();
  const state = useAsync(() => savedMethodsForOrder(apiClient, workspaceId, orderId).catch(() => null), [workspaceId, orderId]);
  const [saving, setSaving] = useState(false);
  const [dialog, setDialog] = useState<{ kind: "charge" | "remove"; method: SavedMethod } | null>(null);

  const data = state.data;
  if (!data || (data.saved.length === 0 && data.saveable.length === 0)) return null;
  // A saved PayPal has no card number: «PayPal», not "PayPal ending ····" (handoff 380).
  const cardName = (m: SavedMethod) => savedMethodPlainName(m) ?? fmt(t.card, { brand: m.brand ?? "", last4: m.last4 ?? "····" });
  const due = formatMoney(data.outstandingAmount, currency);

  async function save(paymentId: string) {
    setSaving(true);
    try {
      await savedMethodsSave(apiClient, workspaceId, paymentId);
      toast.success(t.savedToast);
      await state.refresh({ silent: true });
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function run() {
    if (!dialog) return;
    try {
      if (dialog.kind === "charge") await savedMethodsCharge(apiClient, workspaceId, dialog.method.id, orderId);
      else await savedMethodsDelete(apiClient, workspaceId, dialog.method.id);
    } catch (err) {
      // The bank wants the customer to confirm (not a decline), or the order is already paid (handoff 380).
      throw new Error(savedMethodChargeProblem(err) ?? getErrorMessage(err));
    }
    toast.success(dialog.kind === "charge" ? t.chargedToast : t.removedToast);
    setDialog(null);
    await state.refresh({ silent: true });
    onChanged();
  }

  return (
    <div className="rounded-lg border border-line p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-ink">
        <IconCard className="size-4" aria-hidden />
        {t.title}
      </p>
      <ul className="mt-2 space-y-2">
        {data.saved.map((m) => (
          <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="text-ink">
              <bdi>{cardName(m)}</bdi>
              {m.expired ? (
                <Badge variant="destructive" className="ms-2">
                  {t.expired}
                </Badge>
              ) : (
                m.expiresAt && <span className="ms-2 text-xs text-ink-soft">{fmt(t.expires, { date: formatDate(m.expiresAt) })}</span>
              )}
            </span>
            <span className="flex gap-2">
              {data.outstandingAmount > 0 && !m.expired && (
                <Button size="sm" onClick={() => setDialog({ kind: "charge", method: m })}>
                  {fmt(t.charge, { amount: due })}
                </Button>
              )}
              <Button size="sm" variant="ghost" aria-label={t.remove} onClick={() => setDialog({ kind: "remove", method: m })}>
                <IconDelete className="size-4" aria-hidden />
              </Button>
            </span>
          </li>
        ))}
        {data.saveable.map((p) => (
          <li key={p.paymentId} className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <bdi dir="ltr" className="text-ink-soft">
              {p.maskedDisplay ?? p.provider}
            </bdi>
            <Button size="sm" variant="outline" disabled={saving} onClick={() => void save(p.paymentId)}>
              {saving ? t.saving : t.save}
            </Button>
          </li>
        ))}
      </ul>

      <ConfirmDialog
        open={dialog !== null}
        title={dialog?.kind === "remove" ? t.removeTitle : t.chargeTitle}
        description={
          dialog
            ? dialog.kind === "remove"
              ? t.removeDesc
              : fmt(t.chargeDesc, { amount: due, card: cardName(dialog.method) })
            : undefined
        }
        confirmLabel={dialog?.kind === "remove" ? t.remove : fmt(t.charge, { amount: due })}
        busyLabel={t.working}
        destructive={dialog?.kind === "remove"}
        onCancel={() => setDialog(null)}
        onConfirm={run}
      />
    </div>
  );
}
