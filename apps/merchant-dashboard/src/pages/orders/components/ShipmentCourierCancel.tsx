import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Alert, Button } from "@store-builder/ui";
import { ApiError, apiErrorCode, shipmentManualCancelAllowed, type Shipment } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useCarrierErrorMessage, useErrorMessage } from "@/lib/errorMessages";
import { fmt, useCommon, useT, type Messages } from "@/i18n/LocaleContext";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { useManualCancelPrompt } from "@/pages/shipping/useManualCancelPrompt";

const STRINGS = {
  en: {
    cancel: "Cancel shipment",
    cancelling: "Cancelling the shipment with the courier…",
    cancelledAtCourier: "Shipment cancelled with the courier",
    cancelledHere: "Shipment marked cancelled. You can book a new one.",
    refusedTitle: "The courier refused to cancel this shipment, so it is still live. If the courier already picked it up, contact them",
    permission: "This courier account isn't allowed to cancel shipments. Cancel it in the courier's dashboard",
    notConnected: "Connect the courier account again to cancel this shipment",
    openCouriers: "Open Shipping → Couriers",
    sync: "Sync status",
    syncing: "Syncing…",
    doneMyself: "I cancelled it in the courier's dashboard",
    ackTitle: "Mark this shipment cancelled?",
    ackBody: "Make sure you cancelled shipment {waybill} in the courier's dashboard. We'll keep checking it and warn you if it moves.",
    ackConfirm: "Yes, it's cancelled",
  },
  ar: {
    cancel: "إلغاء الشحنة",
    cancelling: "جاري إلغاء الشحنة عند شركة الشحن…",
    cancelledAtCourier: "اتلغت الشحنة عند شركة الشحن",
    cancelledHere: "الشحنة اتعلّمت ملغية. تقدر تحجز واحدة جديدة.",
    refusedTitle: "شركة الشحن رفضت إلغاء الشحنة، فالشحنة لسه شغالة. لو المندوب استلمها، كلّم شركة الشحن",
    permission: "حساب شركة الشحن مش مسموح له يلغي شحنات. ألغيها من لوحة شركة الشحن",
    notConnected: "اربط حساب شركة الشحن تاني عشان تلغي الشحنة",
    openCouriers: "افتح الشحن ← شركات الشحن",
    sync: "حدّث الحالة",
    syncing: "بنحدّث…",
    doneMyself: "ألغيتها من لوحة شركة الشحن",
    ackTitle: "تعلّم الشحنة دي ملغية؟",
    ackBody: "اتأكد إنك ألغيت الشحنة {waybill} من لوحة شركة الشحن. هنفضل نتابع حالتها، ولو اتحركت هننبهك",
    ackConfirm: "أيوه، اتلغت",
  },
} satisfies Messages;

/** Isolates an LTR run (a waybill) inside plain text, where <bdi> can't go. */
const isolate = (value: string) => `⁦${value}⁩`;

interface Refusal {
  code: string | null;
  /** The headline, in the merchant's language. */
  text: string;
  /** The courier's own sentence, shown under it. */
  detail: string | null;
  manualAllowed: boolean;
}

/**
 * "Cancel shipment" on a courier-booked shipment (handoff 351): the same PATCH
 * as before, but the server now cancels the booking at the courier first. The
 * button says so while it runs; a refusal stays on the card as a box with what
 * the merchant can do next (sync, reconnect, or say they cancelled it in the
 * courier's own dashboard).
 *
 * Returns the button for the card's action row and the box for under it.
 */
export function useCourierShipmentCancel({
  orderId,
  shipment,
  carrier,
  disabled,
  onForbidden,
  onChanged,
  onSync,
  syncing,
}: {
  orderId: string;
  shipment: Shipment;
  carrier: { code: string; name: string };
  disabled: boolean;
  /** A 403 turns the section read-only; true when it took the error. */
  onForbidden: (err: unknown) => boolean;
  onChanged: () => void;
  /** The card's own "Sync status". */
  onSync: () => void;
  syncing: boolean;
}): { busy: boolean; button: ReactNode; panel: ReactNode } {
  const t = useT(STRINGS);
  const common = useCommon();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const carrierError = useCarrierErrorMessage();
  const manualCancelPrompt = useManualCancelPrompt();
  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const [acknowledging, setAcknowledging] = useState(false);

  function done(cancelMode: string | null | undefined) {
    setRefusal(null);
    toast.success(cancelMode === "api" ? t.cancelledAtCourier : t.cancelledHere);
    onChanged();
  }

  async function send(acknowledgeManualCancel: boolean) {
    const updated = await apiClient.updateShipment(workspaceId, orderId, shipment.id, {
      status: "cancelled",
      ...(acknowledgeManualCancel ? { acknowledgeManualCancel: true } : {}),
    });
    done(updated.cancelMode);
  }

  function explain(err: unknown): Refusal {
    const code = apiErrorCode(err) ?? null;
    const reply = err instanceof ApiError && err.message ? err.message : null;
    const manualAllowed = shipmentManualCancelAllowed(err);
    if (code === "CARRIER_CANCEL_FAILED") return { code, text: t.refusedTitle, detail: reply, manualAllowed };
    if (code === "CARRIER_PERMISSION_DENIED") return { code, text: t.permission, detail: null, manualAllowed };
    if (code === "CARRIER_NOT_CONNECTED") return { code, text: t.notConnected, detail: null, manualAllowed };
    return { code, text: carrierError(err, carrier), detail: null, manualAllowed };
  }

  async function cancel() {
    setBusy(true);
    setRefusal(null);
    try {
      await send(false);
    } catch (err) {
      if (onForbidden(err)) return;
      // A courier without a cancel API: the dialog that asks for the merchant's word, as before.
      const offered = manualCancelPrompt.offer(err, async () => {
        try {
          await send(true);
        } catch (retryErr) {
          if (onForbidden(retryErr)) return;
          throw new Error(errorMessage(retryErr));
        }
      });
      if (!offered) setRefusal(explain(err));
    } finally {
      setBusy(false);
    }
  }

  async function acknowledge() {
    try {
      await send(true);
    } catch (err) {
      if (onForbidden(err)) {
        setAcknowledging(false);
        return;
      }
      throw new Error(carrierError(err, carrier));
    }
    setAcknowledging(false);
  }

  const button = (
    <Button
      variant="ghost"
      className="min-h-11 text-danger hover:bg-danger-soft"
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      data-shipment-cancel=""
      onClick={() => void cancel()}
    >
      {busy ? t.cancelling : t.cancel}
    </Button>
  );

  const panel = (
    <>
      {refusal && (
        <Alert variant="danger" className="mt-2">
          <p className="font-medium">{refusal.text}</p>
          {refusal.detail && (
            <p className="mt-1 text-sm" dir="auto">
              {refusal.detail}
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {refusal.code === "CARRIER_CANCEL_FAILED" && (
              <Button type="button" variant="outline" className="min-h-11" disabled={syncing || busy} onClick={onSync}>
                {syncing ? t.syncing : t.sync}
              </Button>
            )}
            {refusal.code === "CARRIER_NOT_CONNECTED" && (
              <Link to="/shipping?tab=carriers" className="inline-flex min-h-11 items-center font-medium text-primary hover:underline">
                {t.openCouriers}
              </Link>
            )}
            {refusal.manualAllowed && (
              <Button type="button" variant="outline" className="min-h-11" disabled={busy} onClick={() => setAcknowledging(true)}>
                {t.doneMyself}
              </Button>
            )}
          </div>
        </Alert>
      )}
      <ConfirmDialog
        open={acknowledging}
        title={t.ackTitle}
        description={fmt(t.ackBody, { waybill: isolate(shipment.waybillNumber ?? shipment.trackingCode) })}
        confirmLabel={t.ackConfirm}
        cancelLabel={common.cancel}
        busyLabel={common.saving}
        destructive
        onCancel={() => setAcknowledging(false)}
        onConfirm={acknowledge}
      />
      {manualCancelPrompt.dialog}
    </>
  );

  return { busy, button, panel };
}
