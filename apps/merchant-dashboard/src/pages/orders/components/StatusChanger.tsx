import { useState, type FormEvent } from "react";
import { Alert, Button } from "@store-builder/ui";
import {
  ApiError,
  ordersChangeStatus,
  ordersNextStages,
  type Order,
  type OrderStage,
  type OrderStatusChangePayload,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { useToast } from "@/components/Toast";
import { Modal } from "@/components/Modal";
import { Field, TextField } from "@/components/Field";
import { Select } from "@/components/Select";
import { Textarea } from "@/components/Textarea";
import { useManualCancelPrompt } from "@/pages/shipping/useManualCancelPrompt";
import { useOrderLabels } from "../orderLabels";
import { useOrderErrorMessage } from "../orderErrors";

const STRINGS = {
  en: {
    button: "Change status",
    title: "Change the status of {number}",
    current: "Now: {stage}",
    moveTo: "Move to",
    reopen: "Reopen the order",
    reason: "Reason",
    reasonOptional: "Reason (optional)",
    reasonRequired: "Enter a reason for the cancellation.",
    reasonHint: "Saved in the order's status history.",
    followUp: "What happened?",
    followUp_unreachable: "No answer",
    followUp_postponed: "Customer asked to postpone",
    courier: "Courier name",
    courierHint: "This order has no shipment yet, so one is recorded for it.",
    courierPlaceholder: "Own delivery",
    waybill: "Tracking number (optional)",
    note_cancelled: "Releases the reserved stock. Refunding a paid order is a separate step.",
    note_reopen: "Takes the stock again and, for cash on delivery, puts the order back in the confirmation queue.",
    note_ready_to_ship: "Marks the order as confirmed with the customer.",
    note_delivered: "Marks the parcel as delivered to the customer.",
    note_returned: "Marks the parcel as returned. Stock comes back only when you restock the return.",
    cancel: "Cancel",
    save: "Change status",
    saving: "Saving…",
    done: "Status changed to “{stage}”.",
  },
  ar: {
    button: "تغيير الحالة",
    title: "تغيير حالة {number}",
    current: "الحالة الآن: {stage}",
    moveTo: "انقل إلى",
    reopen: "إعادة فتح الأوردر",
    reason: "السبب",
    reasonOptional: "السبب (اختياري)",
    reasonRequired: "اكتب سبب الإلغاء.",
    reasonHint: "يُحفظ في سجل حالات الأوردر.",
    followUp: "ماذا حدث؟",
    followUp_unreachable: "لم يرد",
    followUp_postponed: "العميل طلب التأجيل",
    courier: "اسم شركة الشحن أو المندوب",
    courierHint: "هذا الأوردر ليس له شحنة بعد، وسيتم تسجيل شحنة له.",
    courierPlaceholder: "توصيل خاص",
    waybill: "رقم التتبع (اختياري)",
    note_cancelled: "يحرر المخزون المحجوز. استرداد قيمة أوردر مدفوع خطوة منفصلة.",
    note_reopen: "يحجز المخزون من جديد، وأوردر الدفع عند الاستلام يرجع لقائمة التأكيد.",
    note_ready_to_ship: "يسجّل أن الأوردر تم تأكيده مع العميل.",
    note_delivered: "يسجّل أن الطرد تم تسليمه للعميل.",
    note_returned: "يسجّل أن الطرد رجع. المخزون لا يرجع إلا عند إعادة تخزين المرتجع.",
    cancel: "إلغاء",
    save: "تغيير الحالة",
    saving: "جارٍ الحفظ…",
    done: "تم تغيير الحالة إلى «{stage}».",
  },
} satisfies Messages;

const SHIPPING_STAGES: OrderStage[] = ["shipped", "out_for_delivery", "delivered"];

interface Props {
  order: Order;
  onChanged: () => void;
}

/**
 * The order page's status button: opens only the moves the server allows from
 * the order's current stage (`nextStages`), asks for what that move needs —
 * a reason, the follow-up kind, a courier name — and sends it.
 */
export function StatusChanger({ order, onChanged }: Props) {
  const t = useT(STRINGS);
  const [open, setOpen] = useState(false);
  const next = ordersNextStages(order);
  if (!order.stage || next.length === 0) return null;

  return (
    <>
      <Button variant="outline" size="sm" className="min-h-11" onClick={() => setOpen(true)}>
        {t.button}
      </Button>
      {open && (
        <StatusDialog
          order={order}
          next={next}
          onClose={() => setOpen(false)}
          onDone={() => {
            setOpen(false);
            onChanged();
          }}
        />
      )}
    </>
  );
}

function StatusDialog({
  order,
  next,
  onClose,
  onDone,
}: {
  order: Order;
  next: OrderStage[];
  onClose: () => void;
  onDone: () => void;
}) {
  const workspaceId = useWorkspaceId();
  const t = useT(STRINGS);
  const labels = useOrderLabels();
  const toast = useToast();
  const errorMessage = useOrderErrorMessage();
  const manualCancelPrompt = useManualCancelPrompt();

  const [target, setTarget] = useState<OrderStage>(next[0]);
  const [reason, setReason] = useState("");
  const [followUp, setFollowUp] = useState<"unreachable" | "postponed">("unreachable");
  const [courier, setCourier] = useState("");
  const [waybill, setWaybill] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reopening = order.stage === "cancelled";
  const hasLiveShipment = (order.shipments ?? []).some((s) => s.status !== "cancelled" && s.status !== "returned");
  const needsCourier = SHIPPING_STAGES.includes(target) && !hasLiveShipment;
  const reasonRequired = target === "cancelled";

  const note = reopening
    ? t.note_reopen
    : target === "cancelled"
      ? t.note_cancelled
      : target === "ready_to_ship"
        ? t.note_ready_to_ship
        : target === "delivered"
          ? t.note_delivered
          : target === "returned"
            ? t.note_returned
            : null;

  function payload(acknowledgeManualCancel: boolean): OrderStatusChangePayload {
    return {
      status: target,
      reason: reason.trim() || undefined,
      ...(target === "needs_follow_up" ? { followUp } : {}),
      ...(needsCourier && courier.trim() ? { carrierCode: courier.trim() } : {}),
      ...(needsCourier && waybill.trim() ? { waybillNumber: waybill.trim() } : {}),
      ...(acknowledgeManualCancel ? { acknowledgeManualCancel: true } : {}),
    };
  }

  async function send(acknowledgeManualCancel: boolean) {
    const updated = await ordersChangeStatus(apiClient, workspaceId, order.id, payload(acknowledgeManualCancel));
    toast.success(fmt(t.done, { stage: labels.stage(updated.stage ?? target) }));
    onDone();
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (reasonRequired && !reason.trim()) {
      setError(t.reasonRequired);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await send(false);
    } catch (err) {
      // A courier without a cancel API: the merchant cancels the booking in
      // the courier's dashboard, confirms, and the same change is sent again.
      const offered = manualCancelPrompt.offer(err, async () => {
        try {
          await send(true);
        } catch (retryErr) {
          throw retryErr instanceof ApiError ? new Error(errorMessage(retryErr)) : retryErr;
        }
      });
      if (!offered) setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Modal
        open={!manualCancelPrompt.isOpen}
        onClose={saving ? () => undefined : onClose}
        title={fmt(t.title, { number: order.orderNumber })}
        description={order.stage ? fmt(t.current, { stage: labels.stage(order.stage) }) : undefined}
      >
        <form onSubmit={submit} className="space-y-4" noValidate>
          {error && (
            <Alert variant="danger" role="alert">
              {error}
            </Alert>
          )}

          <Field label={t.moveTo}>
            {({ id }) => (
              <Select id={id} value={target} onChange={(e) => setTarget(e.target.value as OrderStage)} className="h-11">
                {next.map((stage) => (
                  <option key={stage} value={stage}>
                    {reopening ? t.reopen : labels.stage(stage)}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          {target === "needs_follow_up" && (
            <Field label={t.followUp}>
              {({ id }) => (
                <Select
                  id={id}
                  value={followUp}
                  onChange={(e) => setFollowUp(e.target.value as "unreachable" | "postponed")}
                  className="h-11"
                >
                  <option value="unreachable">{t.followUp_unreachable}</option>
                  <option value="postponed">{t.followUp_postponed}</option>
                </Select>
              )}
            </Field>
          )}

          {needsCourier && (
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label={t.courier}
                hint={t.courierHint}
                value={courier}
                maxLength={100}
                placeholder={t.courierPlaceholder}
                onChange={(e) => setCourier(e.target.value)}
              />
              <TextField
                label={t.waybill}
                value={waybill}
                maxLength={100}
                dir="ltr"
                onChange={(e) => setWaybill(e.target.value)}
              />
            </div>
          )}

          <Field label={reasonRequired ? t.reason : t.reasonOptional} required={reasonRequired} hint={t.reasonHint}>
            {({ id }) => (
              <Textarea id={id} rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
            )}
          </Field>

          {note && <p className="text-sm text-ink-soft">{note}</p>}

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" className="min-h-11" onClick={onClose} disabled={saving}>
              {t.cancel}
            </Button>
            <Button
              type="submit"
              variant={target === "cancelled" ? "danger" : "default"}
              className="min-h-11"
              disabled={saving}
            >
              {saving ? t.saving : t.save}
            </Button>
          </div>
        </form>
      </Modal>
      {manualCancelPrompt.dialog}
    </>
  );
}
