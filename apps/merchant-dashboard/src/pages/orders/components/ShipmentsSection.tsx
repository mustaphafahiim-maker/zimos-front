import { useState, type FormEvent } from "react";
import { Alert, Button, Card, CardContent } from "@store-builder/ui";
import type { Shipment, ShipmentStatus } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { getErrorMessage, getFieldErrors } from "@/lib/errors";
import { formatDateTime } from "@/lib/format";
import { useT, fmt, type Messages } from "@/i18n/LocaleContext";
import { useToast } from "@/components/Toast";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { TextField } from "@/components/Field";
import { Select } from "@/components/Select";
import { useEnumLabel } from "../orderLabels";

const STRINGS = {
  en: {
    shipments: "Shipments",
    empty: "No shipments yet.",
    via: "via {carrier}",
    waybill: "Waybill",
    track: "Track",
    shipped: "Shipped {date}",
    delivered: "Delivered {date}",
    setStatus: "Set status",
    markedToast: "Shipment marked “{status}”.",
    createdToast: "Shipment created.",
    orderCancelled: "Order is cancelled — no new shipments.",
    addShipment: "Add a shipment",
    carrier: "Carrier",
    waybillNumber: "Waybill #",
    trackingUrl: "Tracking URL",
    creating: "Creating…",
    createShipment: "Create shipment",
  },
  ar: {
    shipments: "الشحنات",
    empty: "لا توجد شحنات بعد.",
    via: "عبر {carrier}",
    waybill: "بوليصة",
    track: "تتبّع",
    shipped: "تم الشحن {date}",
    delivered: "تم التسليم {date}",
    setStatus: "تغيير الحالة",
    markedToast: "تم تغيير حالة الشحنة إلى «{status}».",
    createdToast: "تم إنشاء الشحنة.",
    orderCancelled: "الطلب ملغي — لا يمكن إضافة شحنات جديدة.",
    addShipment: "إضافة شحنة",
    carrier: "شركة الشحن",
    waybillNumber: "رقم البوليصة",
    trackingUrl: "رابط التتبّع",
    creating: "جارٍ الإنشاء…",
    createShipment: "إنشاء الشحنة",
  },
} satisfies Messages;

const STATUSES: ShipmentStatus[] = [
  "created",
  "picked_up",
  "in_transit",
  "out_for_delivery",
  "delivered",
  "failed",
  "returned",
  "cancelled",
];

interface Props {
  orderId: string;
  shipments: Shipment[];
  orderCancelled: boolean;
  onChanged: () => void;
}

export function ShipmentsSection({ orderId, shipments, orderCancelled, onChanged }: Props) {
  const t = useT(STRINGS);
  const label = useEnumLabel();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);

  const [carrierCode, setCarrierCode] = useState("manual");
  const [waybillNumber, setWaybillNumber] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function updateStatus(shipment: Shipment, status: ShipmentStatus) {
    setBusyId(shipment.id);
    try {
      await apiClient.updateShipment(workspaceId, orderId, shipment.id, { status });
      toast.success(fmt(t.markedToast, { status: label(status) }));
      onChanged();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  async function create(e: FormEvent) {
    e.preventDefault();
    setCreating(true);
    setFormError(null);
    setFieldErrors({});
    try {
      await apiClient.createShipment(workspaceId, orderId, {
        carrierCode: carrierCode.trim() || "manual",
        waybillNumber: waybillNumber.trim() || undefined,
        trackingUrl: trackingUrl.trim() || undefined,
      });
      toast.success(t.createdToast);
      setWaybillNumber("");
      setTrackingUrl("");
      onChanged();
    } catch (err) {
      const fields = getFieldErrors(err);
      setFieldErrors(fields);
      if (Object.keys(fields).length === 0) setFormError(getErrorMessage(err));
    } finally {
      setCreating(false);
    }
  }

  return (
    <Card className="rounded-2xl">
      <CardContent className="pt-6">
        <h2 className="mb-3 font-display text-lg font-semibold text-ink">{t.shipments}</h2>

        {shipments.length === 0 ? (
          <EmptyState title={t.empty} />
        ) : (
          <ul className="space-y-3">
            {shipments.map((s) => (
              <li key={s.id} className="rounded-xl border border-line px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="font-medium text-ink" dir="ltr">
                      {s.trackingCode}
                    </span>
                    <span className="ms-2 text-sm text-ink-soft">
                      {fmt(t.via, { carrier: s.carrierCode })}
                    </span>
                  </div>
                  <StatusBadge value={s.status} />
                </div>
                <div className="mt-1 text-xs text-ink-soft">
                  {s.waybillNumber && (
                    <span>
                      {t.waybill} <span dir="ltr">{s.waybillNumber}</span> ·{" "}
                    </span>
                  )}
                  {s.trackingUrl && (
                    <a
                      href={s.trackingUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary hover:underline"
                    >
                      {t.track}
                    </a>
                  )}
                  {s.shippedAt && <span> · {fmt(t.shipped, { date: formatDateTime(s.shippedAt) })}</span>}
                  {s.deliveredAt && <span> · {fmt(t.delivered, { date: formatDateTime(s.deliveredAt) })}</span>}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-ink-soft">{t.setStatus}</span>
                  <Select
                    aria-label={t.setStatus}
                    value={s.status}
                    disabled={busyId === s.id}
                    onChange={(e) => updateStatus(s, e.target.value as ShipmentStatus)}
                    className="h-8 w-48 text-[13px]"
                  >
                    {STATUSES.map((st) => (
                      <option key={st} value={st}>
                        {label(st)}
                      </option>
                    ))}
                  </Select>
                </div>
              </li>
            ))}
          </ul>
        )}

        {orderCancelled ? (
          <p className="mt-4 text-sm text-ink-soft">{t.orderCancelled}</p>
        ) : (
          <form onSubmit={create} className="mt-4 space-y-3 border-t border-line pt-4">
            <h3 className="text-sm font-medium text-ink">{t.addShipment}</h3>
            {formError && <Alert variant="danger">{formError}</Alert>}
            <div className="grid gap-3 sm:grid-cols-3">
              <TextField
                label={t.carrier}
                value={carrierCode}
                onChange={(e) => setCarrierCode(e.target.value)}
                error={fieldErrors.carrierCode}
                dir="ltr"
              />
              <TextField
                label={t.waybillNumber}
                value={waybillNumber}
                onChange={(e) => setWaybillNumber(e.target.value)}
                error={fieldErrors.waybillNumber}
                dir="ltr"
              />
              <TextField
                label={t.trackingUrl}
                value={trackingUrl}
                onChange={(e) => setTrackingUrl(e.target.value)}
                error={fieldErrors.trackingUrl}
                dir="ltr"
              />
            </div>
            <div className="flex justify-end">
              <Button type="submit" size="sm" disabled={creating}>
                {creating ? t.creating : t.createShipment}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
