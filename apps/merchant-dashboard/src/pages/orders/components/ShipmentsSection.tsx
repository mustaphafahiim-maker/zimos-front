import { useEffect, useState, type FormEvent } from "react";
import { Alert, Button, Card, CardContent } from "@store-builder/ui";
import type { BostaCity, BostaDistrict, Shipment, ShipmentStatus } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { getErrorMessage, getFieldErrors } from "@/lib/errors";
import { formatDateTime, humanize } from "@/lib/format";
import { useToast } from "@/components/Toast";
import { StatusBadge } from "@/components/StatusBadge";
import { TextField } from "@/components/Field";
import { Select } from "@/components/Select";
import { useLocale, useT, type Messages } from "@/i18n/LocaleContext";

// Bosta district picker — resolves the district a Bosta shipment needs (see
// backend src/modules/shipping/carriers/bostaCarrier.js#buildDropOffAddress)
// for one shipment at booking time. Only shown once GET .../bosta/cities
// actually returns cities (i.e. Bosta is connected for this store); stays
// hidden, no error, otherwise.
const STRINGS = {
  en: {
    bostaCity: "Bosta city",
    bostaDistrict: "Bosta district",
    bostaCityPlaceholder: "Select a city…",
    bostaDistrictPlaceholder: "Select a district…",
    bostaHint: "Optional — helps Bosta place this delivery precisely.",
  },
  ar: {
    bostaCity: "مدينة بوسطة",
    bostaDistrict: "منطقة بوسطة",
    bostaCityPlaceholder: "اختر مدينة…",
    bostaDistrictPlaceholder: "اختر منطقة…",
    bostaHint: "اختياري — يساعد بوسطة على تحديد عنوان التوصيل بدقة.",
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
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const t = useT(STRINGS);
  const { locale } = useLocale();
  const [busyId, setBusyId] = useState<string | null>(null);

  const [carrierCode, setCarrierCode] = useState("manual");
  const [waybillNumber, setWaybillNumber] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Bosta district picker state. `citiesRequested` guards against re-fetching
  // every time the carrier field is toggled; an empty `cities` list (Bosta
  // not connected, or the lookup failed) just keeps the picker hidden.
  const isBosta = carrierCode.trim() === "bosta";
  const [citiesRequested, setCitiesRequested] = useState(false);
  const [cities, setCities] = useState<BostaCity[]>([]);
  const [districts, setDistricts] = useState<BostaDistrict[]>([]);
  const [districtsLoading, setDistrictsLoading] = useState(false);
  const [bostaCityId, setBostaCityId] = useState("");
  const [bostaDistrictId, setBostaDistrictId] = useState("");

  useEffect(() => {
    if (!isBosta || citiesRequested) return;
    setCitiesRequested(true);
    apiClient
      .listBostaCities(workspaceId)
      .then((list) => setCities(list))
      .catch(() => setCities([])); // quietly no picker — never a scary error here
  }, [isBosta, citiesRequested, workspaceId]);

  useEffect(() => {
    if (!isBosta) {
      setBostaCityId("");
      setBostaDistrictId("");
      setDistricts([]);
    }
  }, [isBosta]);

  async function onBostaCityChange(cityId: string) {
    setBostaCityId(cityId);
    setBostaDistrictId("");
    setDistricts([]);
    if (!cityId) return;
    setDistrictsLoading(true);
    try {
      setDistricts(await apiClient.listBostaDistricts(workspaceId, cityId));
    } catch {
      setDistricts([]);
    } finally {
      setDistrictsLoading(false);
    }
  }

  async function updateStatus(shipment: Shipment, status: ShipmentStatus) {
    setBusyId(shipment.id);
    try {
      await apiClient.updateShipment(workspaceId, orderId, shipment.id, { status });
      toast.success(`Shipment marked "${humanize(status)}".`);
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
        ...(isBosta && bostaDistrictId ? { bostaDistrictId } : {}),
      });
      toast.success("Shipment created.");
      setWaybillNumber("");
      setTrackingUrl("");
      setBostaCityId("");
      setBostaDistrictId("");
      setDistricts([]);
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
    <Card>
      <CardContent className="pt-6">
        <h2 className="mb-3 font-display text-lg font-medium text-ink">Shipments</h2>

        {shipments.length === 0 ? (
          <p className="rounded-[0.5rem] border border-dashed border-line px-4 py-6 text-center text-sm text-ink-soft">
            No shipments yet.
          </p>
        ) : (
          <ul className="space-y-3">
            {shipments.map((s) => (
              <li key={s.id} className="rounded-[0.5rem] border border-line px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-medium text-ink">{s.trackingCode}</span>
                    <span className="ms-2 text-sm text-ink-soft">via {s.carrierCode}</span>
                  </div>
                  <StatusBadge value={s.status} />
                </div>
                <div className="mt-1 text-xs text-ink-soft">
                  {s.waybillNumber && <span>Waybill {s.waybillNumber} · </span>}
                  {s.trackingUrl && (
                    <a
                      href={s.trackingUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary hover:underline"
                    >
                      Track
                    </a>
                  )}
                  {s.shippedAt && <span> · Shipped {formatDateTime(s.shippedAt)}</span>}
                  {s.deliveredAt && <span> · Delivered {formatDateTime(s.deliveredAt)}</span>}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs text-ink-soft">Set status</span>
                  <Select
                    value={s.status}
                    disabled={busyId === s.id}
                    onChange={(e) => updateStatus(s, e.target.value as ShipmentStatus)}
                    className="h-8 w-48 text-[13px]"
                  >
                    {STATUSES.map((st) => (
                      <option key={st} value={st}>
                        {humanize(st)}
                      </option>
                    ))}
                  </Select>
                </div>
              </li>
            ))}
          </ul>
        )}

        {orderCancelled ? (
          <p className="mt-4 text-sm text-ink-soft">Order is cancelled — no new shipments.</p>
        ) : (
          <form onSubmit={create} className="mt-4 space-y-3 border-t border-line pt-4">
            <h3 className="text-sm font-medium text-ink">Add a shipment</h3>
            {formError && <Alert variant="danger">{formError}</Alert>}
            <div className="grid gap-3 sm:grid-cols-3">
              <TextField
                label="Carrier"
                value={carrierCode}
                onChange={(e) => setCarrierCode(e.target.value)}
                error={fieldErrors.carrierCode}
              />
              <TextField
                label="Waybill #"
                value={waybillNumber}
                onChange={(e) => setWaybillNumber(e.target.value)}
                error={fieldErrors.waybillNumber}
              />
              <TextField
                label="Tracking URL"
                value={trackingUrl}
                onChange={(e) => setTrackingUrl(e.target.value)}
                error={fieldErrors.trackingUrl}
              />
            </div>

            {isBosta && cities.length > 0 && (
              <div className="rounded-[0.5rem] border border-line bg-paper px-3 py-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm">
                    <span className="mb-1 block text-ink-soft">{t.bostaCity}</span>
                    <Select
                      value={bostaCityId}
                      onChange={(e) => onBostaCityChange(e.target.value)}
                      className="h-9 w-full text-[13px]"
                    >
                      <option value="">{t.bostaCityPlaceholder}</option>
                      {cities.map((c) => (
                        <option key={c._id} value={c._id}>
                          {locale === "ar" && c.nameAr ? c.nameAr : c.name}
                        </option>
                      ))}
                    </Select>
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block text-ink-soft">{t.bostaDistrict}</span>
                    <Select
                      value={bostaDistrictId}
                      onChange={(e) => setBostaDistrictId(e.target.value)}
                      disabled={!bostaCityId || districtsLoading}
                      className="h-9 w-full text-[13px]"
                    >
                      <option value="">{t.bostaDistrictPlaceholder}</option>
                      {districts.map((d) => (
                        <option key={d.districtId} value={d.districtId}>
                          {locale === "ar" && d.districtOtherName ? d.districtOtherName : d.districtName}
                        </option>
                      ))}
                    </Select>
                  </label>
                </div>
                <p className="mt-2 text-xs text-ink-soft">{t.bostaHint}</p>
              </div>
            )}

            <div className="flex justify-end">
              <Button type="submit" size="sm" disabled={creating}>
                {creating ? "Creating…" : "Create shipment"}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
