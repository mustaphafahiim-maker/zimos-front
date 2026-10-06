"use client";

import { useState } from "react";
import { apiErrorCode, trackTransferOf, transferResubmit, type ManualTransferStoreMethod, type TrackResult } from "@store-builder/api-client";
import { createStorefrontApiClient } from "@/lib/apiClient";
import { pickText } from "@/lib/i18n";
import { useStore } from "@/lib/StoreContext";
import { getVisitorId } from "@/lib/visitorId";
import { TransferDetails, transferProblem, useTransferCopy, type TransferState } from "./checkout/TransferDetails";
import { btnPrimaryLg } from "./ui";

const TEXT = {
  en: {
    reviewTitle: "Your transfer is being reviewed",
    reviewBody: "The store will confirm it once the money arrives.",
    rejectedTitle: "We couldn't confirm your transfer",
    reason: "The store's note",
    again: "Transfer again, or send a clearer receipt, below.",
    gone: "This way to pay is no longer offered. Contact the store to finish the order.",
    send: "Send the new receipt",
    sending: "Sending…",
    sent: "Thank you — your new receipt is with the store for review.",
    failed: "That didn't go through. Try again.",
  },
  ar: {
    reviewTitle: "تحويلك قيد المراجعة",
    reviewBody: "المتجر هيأكد الطلب أول ما الفلوس توصل.",
    rejectedTitle: "مقدرناش نأكد التحويل بتاعك",
    reason: "ملاحظة المتجر",
    again: "حوّل تاني، أو ابعت صورة إيصال أوضح، من تحت.",
    gone: "طريقة الدفع دي مبقتش متاحة. كلّم المتجر عشان تكمّل الطلب.",
    send: "ابعت الإيصال الجديد",
    sending: "جارٍ الإرسال…",
    sent: "شكرًا — الإيصال الجديد وصل للمتجر للمراجعة.",
    failed: "محصلش. حاول تاني.",
  },
  fr: {
    reviewTitle: "Votre virement est en cours de vérification",
    reviewBody: "La boutique le confirmera dès réception de l'argent.",
    rejectedTitle: "Nous n'avons pas pu confirmer votre virement",
    reason: "Note de la boutique",
    again: "Refaites le virement, ou envoyez un reçu plus lisible, ci-dessous.",
    gone: "Ce moyen de paiement n'est plus proposé. Contactez la boutique pour finaliser la commande.",
    send: "Envoyer le nouveau reçu",
    sending: "Envoi…",
    sent: "Merci — votre nouveau reçu est entre les mains de la boutique.",
    failed: "Cela n'a pas marché. Réessayez.",
  },
};

/**
 * The order's transfer on the tracking page (backend payments/transferResubmit.js):
 * under review, or rejected — with the store's note, the method's
 * instructions and the checkout's own receipt form to send it again.
 */
export function TrackOrderTransfer({ result, workspaceId }: { result: TrackResult; workspaceId: string }) {
  const { locale, money } = useStore();
  const t = pickText(TEXT, locale);
  const copy = useTransferCopy();
  const transfer = trackTransferOf(result);
  const token = (result as TrackResult & { trackingToken?: string }).trackingToken ?? "";
  const [state, setState] = useState<TransferState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [client] = useState(() => createStorefrontApiClient());
  if (!transfer) return null;

  if (transfer.status === "under_review" || sent) {
    return (
      <div className="mt-6 rounded-xl border border-line bg-primary-soft px-4 py-3" role="status">
        <p className="text-sm font-semibold text-ink">{sent ? t.sent : t.reviewTitle}</p>
        {!sent && <p className="mt-0.5 text-sm text-ink-soft">{t.reviewBody}</p>}
      </div>
    );
  }

  const method: ManualTransferStoreMethod | null = transfer.method
    ? { ...transfer.method, provider: "manual", method: "bank_transfer", mode: "live" }
    : null;

  async function send() {
    if (!method || busy) return;
    const problem = transferProblem(method, state, copy);
    if (problem) return setError(problem);
    setBusy(true);
    setError(null);
    try {
      await transferResubmit(
        client,
        workspaceId,
        { token, receiptUploadId: state?.details.receiptUploadId ?? null, senderReference: state?.details.senderReference ?? null },
        getVisitorId(workspaceId)
      );
      setSent(true);
    } catch (err) {
      const code = apiErrorCode(err);
      setError(code === "VALIDATION_ERROR" ? copy.needReceipt : code === "PAYMENT_METHOD_UNAVAILABLE" ? t.gone : t.failed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 space-y-3 rounded-xl border border-danger/40 bg-danger-soft/40 p-4">
      <p className="text-sm font-semibold text-danger">{t.rejectedTitle}</p>
      {transfer.reason && (
        <p className="text-sm text-ink">
          <span className="text-ink-soft">{t.reason}: </span>
          <bdi>{transfer.reason}</bdi>
        </p>
      )}
      {method ? (
        <>
          <p className="text-sm text-ink-soft">{t.again}</p>
          <TransferDetails
            client={client}
            workspaceId={workspaceId}
            methods={[method]}
            amountLabel={money(transfer.amount, transfer.currency)}
            deposit={transfer.purpose === "deposit" ? "fixed" : undefined}
            idPrefix="track-transfer"
            onChange={(_, next) => setState(next)}
          />
          {error && (
            <p role="alert" className="text-sm font-medium text-danger">
              {error}
            </p>
          )}
          <button type="button" onClick={() => void send()} disabled={busy || !token} aria-busy={busy} className={btnPrimaryLg}>
            {busy ? t.sending : t.send}
          </button>
        </>
      ) : (
        <p className="text-sm text-ink">{t.gone}</p>
      )}
    </div>
  );
}
