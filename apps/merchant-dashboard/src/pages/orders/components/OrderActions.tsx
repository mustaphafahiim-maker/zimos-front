import { useState, type FormEvent } from "react";
import { Alert, Button } from "@store-builder/ui";
import type { Order, UpdateOrderPayload } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { getErrorMessage, getFieldErrors } from "@/lib/errors";
import { useT, useCommon, fmt, type Messages } from "@/i18n/LocaleContext";
import { useToast } from "@/components/Toast";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { TextField, Field } from "@/components/Field";
import { Textarea } from "@/components/Textarea";
import { ltr } from "../orderLabels";

const STRINGS = {
  en: {
    editAddressNotes: "Edit address / notes",
    preparing: "Preparing…",
    downloadWaybill: "Download waybill",
    cancelOrder: "Cancel order",
    cancelled: "Cancelled",
    shippedNote: "Shipped — cancel/edit are disabled; open a return instead.",
    reasonRequired: "Enter a reason for the cancellation.",
    cancelledToast: "Order cancelled. The stock reservation has been released.",
    cancelTitle: "Cancel {order}?",
    cancelDescription:
      "Releases the inventory reservation and moves confirmation to “rejected”. Refunding a paid order is a separate step.",
    cancelConfirm: "Cancel this order",
    reason: "Reason",
    reasonPlaceholder: "Customer changed their mind",
    editTitle: "Edit {order}",
    updatedToast: "Order updated.",
    editHint: "Only the shipping address and internal notes are editable. Totals aren't re-priced.",
    country: "Country (2-letter)",
    city: "City",
    province: "Province",
    postalCode: "Postal code",
    addressLine: "Address line",
    internalNotes: "Internal notes",
    saveChanges: "Save changes",
  },
  ar: {
    editAddressNotes: "تعديل العنوان / الملاحظات",
    preparing: "جارٍ التجهيز…",
    downloadWaybill: "تحميل بوليصة الشحن",
    cancelOrder: "إلغاء الطلب",
    cancelled: "ملغي",
    shippedNote: "تم الشحن — الإلغاء والتعديل غير متاحين؛ افتح مرتجعًا بدلًا من ذلك.",
    reasonRequired: "أدخل سبب الإلغاء.",
    cancelledToast: "تم إلغاء الطلب وتحرير الكمية المحجوزة من المخزون.",
    cancelTitle: "إلغاء الطلب {order}؟",
    cancelDescription:
      "سيتم تحرير الكمية المحجوزة من المخزون وتغيير حالة التأكيد إلى «مرفوض». استرداد مبلغ الطلب المدفوع خطوة منفصلة.",
    cancelConfirm: "إلغاء هذا الطلب",
    reason: "السبب",
    reasonPlaceholder: "العميل غيّر رأيه",
    editTitle: "تعديل الطلب {order}",
    updatedToast: "تم تحديث الطلب.",
    editHint: "يمكن تعديل عنوان الشحن والملاحظات الداخلية فقط. لن يُعاد حساب الإجماليات.",
    country: "الدولة (رمز من حرفين)",
    city: "المدينة",
    province: "المحافظة",
    postalCode: "الرمز البريدي",
    addressLine: "العنوان",
    internalNotes: "ملاحظات داخلية",
    saveChanges: "حفظ التغييرات",
  },
} satisfies Messages;

const SHIPPED_STATES = ["fulfilled", "partially_fulfilled", "returned"];

interface Props {
  order: Order;
  onChanged: () => void;
}

export function OrderActions({ order, onChanged }: Props) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");
  const [editing, setEditing] = useState(false);
  const [waybillBusy, setWaybillBusy] = useState(false);

  const isCancelled = Boolean(order.cancelledAt);
  const isShipped = SHIPPED_STATES.includes(order.fulfillmentState);
  const canCancel = !isCancelled && !isShipped;
  const canEdit = !isCancelled && !isShipped;

  async function confirmCancel() {
    if (reason.trim().length === 0) throw new Error(t.reasonRequired);
    await apiClient.cancelOrder(workspaceId, order.id, reason.trim());
    toast.success(t.cancelledToast);
    setCancelling(false);
    setReason("");
    onChanged();
  }

  async function downloadWaybill() {
    setWaybillBusy(true);
    try {
      const blob = await apiClient.getWaybillPdf(workspaceId, order.id);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener");
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setWaybillBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canEdit && (
        <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
          {t.editAddressNotes}
        </Button>
      )}
      <Button variant="outline" size="sm" onClick={downloadWaybill} disabled={waybillBusy}>
        {waybillBusy ? t.preparing : t.downloadWaybill}
      </Button>
      {canCancel && (
        <Button
          variant="danger"
          size="sm"
          onClick={() => {
            setReason("");
            setCancelling(true);
          }}
        >
          {t.cancelOrder}
        </Button>
      )}
      {isCancelled && (
        <span className="min-w-0 text-sm text-danger">
          {t.cancelled}
          {order.cancellationReason ? ` — ${order.cancellationReason}` : ""}
        </span>
      )}
      {!isCancelled && isShipped && (
        <span className="min-w-0 text-sm text-ink-soft">{t.shippedNote}</span>
      )}

      <ConfirmDialog
        open={cancelling}
        title={fmt(t.cancelTitle, { order: ltr(order.orderNumber) })}
        description={t.cancelDescription}
        confirmLabel={t.cancelConfirm}
        destructive
        onCancel={() => setCancelling(false)}
        onConfirm={confirmCancel}
      >
        <TextField
          label={t.reason}
          required
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t.reasonPlaceholder}
        />
      </ConfirmDialog>

      <Modal
        open={editing}
        onClose={() => setEditing(false)}
        title={fmt(t.editTitle, { order: ltr(order.orderNumber) })}
      >
        <EditOrderForm
          order={order}
          onCancel={() => setEditing(false)}
          onDone={() => {
            setEditing(false);
            toast.success(t.updatedToast);
            onChanged();
          }}
        />
      </Modal>
    </div>
  );
}

function EditOrderForm({
  order,
  onDone,
  onCancel,
}: {
  order: Order;
  onDone: () => void;
  onCancel: () => void;
}) {
  const t = useT(STRINGS);
  const c = useCommon();
  const workspaceId = useWorkspaceId();
  const addr = order.shippingAddressSnapshot ?? {};
  const [country, setCountry] = useState(addr.country ?? "EG");
  const [city, setCity] = useState(addr.city ?? "");
  const [province, setProvince] = useState(addr.province ?? "");
  const [addressLine, setAddressLine] = useState(addr.addressLine ?? "");
  const [postalCode, setPostalCode] = useState(addr.postalCode ?? "");
  const [notes, setNotes] = useState(order.notes ?? "");

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    setFieldErrors({});
    const payload: UpdateOrderPayload = { notes: notes.trim() };
    if (addressLine.trim() && city.trim() && country.trim()) {
      payload.shippingAddress = {
        country: country.trim().toUpperCase(),
        city: city.trim(),
        addressLine: addressLine.trim(),
        province: province.trim() || undefined,
        postalCode: postalCode.trim() || undefined,
      };
    }
    try {
      await apiClient.updateOrder(workspaceId, order.id, payload);
      onDone();
    } catch (err) {
      const fields = getFieldErrors(err);
      setFieldErrors(fields);
      if (Object.keys(fields).length === 0) setFormError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {formError && <Alert variant="danger">{formError}</Alert>}
      <p className="text-sm text-ink-soft">{t.editHint}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label={t.country}
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          error={fieldErrors["shippingAddress.country"]}
          dir="ltr"
        />
        <TextField
          label={t.city}
          value={city}
          onChange={(e) => setCity(e.target.value)}
          error={fieldErrors["shippingAddress.city"]}
        />
        <TextField
          label={t.province}
          value={province}
          onChange={(e) => setProvince(e.target.value)}
          error={fieldErrors["shippingAddress.province"]}
        />
        <TextField
          label={t.postalCode}
          value={postalCode}
          onChange={(e) => setPostalCode(e.target.value)}
          error={fieldErrors["shippingAddress.postalCode"]}
          dir="ltr"
        />
      </div>
      <TextField
        label={t.addressLine}
        value={addressLine}
        onChange={(e) => setAddressLine(e.target.value)}
        error={fieldErrors["shippingAddress.addressLine"]}
      />
      <Field label={t.internalNotes} error={fieldErrors.notes}>
        {({ id }) => (
          <Textarea id={id} value={notes} onChange={(e) => setNotes(e.target.value)} />
        )}
      </Field>
      <div className="flex flex-wrap justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          {c.cancel}
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? c.saving : t.saveChanges}
        </Button>
      </div>
    </form>
  );
}
