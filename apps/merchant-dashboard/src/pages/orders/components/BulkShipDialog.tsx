import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, Button } from "@store-builder/ui";
import {
  carrierRegionSet,
  shipmentBatchPreview,
  shipmentBatchStart,
  type ShipmentBatchAddresses,
  type ShipmentBatchPreview,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { fmt, useLocale, useT } from "@/i18n/LocaleContext";
import { DataState } from "@/components/DataState";
import { Modal } from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { CourierPlacePicker } from "@/pages/shipping/CourierPlacePicker";
import { useOrderErrorMessage } from "../orderErrors";

const STRINGS = {
  en: {
    title: "Ship {count} orders with {name}",
    summary:
      "{ready} ready to book · {missing} need an area · {blocked} can't ship",
    readyTitle: "Ready to book",
    readyHint:
      "Each order is booked with {name} in the background; you'll get a report per order.",
    missingTitle: "Need an area on {name}'s list",
    regionGroup: "{area} — {count} orders",
    regionHint: "Saved for every order from {area}, now and later.",
    orderHint: "For this order only.",
    orderAddress: "{province} / {city}",
    choose: "Choose area",
    blockedTitle: "Can't ship",
    book: "Book {count} orders",
    booking: "Starting…",
    cancel: "Cancel",
    started: "Booking {count} orders with {name}.",
    regionSaved: "{area} is now {place} on {name}.",
    orderSaved: "{order} will go to {place}.",
    nothingReady: "No order is ready to book yet.",
  },
  ar: {
    title: "شحن {count} طلب مع {name}",
    summary:
      "{ready} جاهز للحجز · {missing} يحتاج منطقة · {blocked} لا يمكن شحنه",
    readyTitle: "جاهز للحجز",
    readyHint: "يُحجز كل طلب مع {name} في الخلفية، ويصلك تقرير لكل طلب.",
    missingTitle: "يحتاج منطقة من قائمة {name}",
    regionGroup: "{area} — {count} طلب",
    regionHint: "يُحفظ لكل الطلبات من {area}، الآن ولاحقًا.",
    orderHint: "لهذا الطلب فقط.",
    orderAddress: "{province} / {city}",
    choose: "اختيار المنطقة",
    blockedTitle: "لا يمكن شحنه",
    book: "حجز {count} طلب",
    booking: "جارٍ البدء…",
    cancel: "إلغاء",
    started: "جارٍ حجز {count} طلب مع {name}.",
    regionSaved: "أصبحت {area} {place} مع {name}.",
    orderSaved: "سيُشحن {order} إلى {place}.",
    nothingReady: "لا يوجد طلب جاهز للحجز بعد.",
  },
};

type Missing = ShipmentBatchPreview["missing"][number];

/**
 * "Ship selected" with a connected courier: shows which orders are ready,
 * lets the merchant place the ones the courier's list doesn't match (on the
 * areas map, or for one order), then queues the batch and opens its report.
 */
export function BulkShipDialog({
  carrierCode,
  orderIds,
  onClose,
  onStarted,
}: {
  carrierCode: string;
  orderIds: string[];
  onClose: () => void;
  onStarted: () => void;
}) {
  const t = useT(STRINGS);
  const { locale } = useLocale();
  const workspaceId = useWorkspaceId();
  const navigate = useNavigate();
  const toast = useToast();
  const errorMessage = useOrderErrorMessage();
  const [addresses, setAddresses] = useState<ShipmentBatchAddresses>({});
  const [fixing, setFixing] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const preview = useAsync(
    () =>
      shipmentBatchPreview(apiClient, workspaceId, {
        carrierCode,
        orderIds,
        addresses,
      }),
    [workspaceId, carrierCode, orderIds.join(","), JSON.stringify(addresses)],
  );
  const data = preview.data;
  const name = data?.carrierName ?? carrierCode;

  // Orders whose city is on the platform's list are fixed once for the city; the rest one by one.
  const { byRegion, single } = useMemo(() => {
    const groups = new Map<string, Missing[]>();
    const alone: Missing[] = [];
    for (const m of data?.missing ?? []) {
      if (m.region)
        groups.set(m.region.code, [...(groups.get(m.region.code) ?? []), m]);
      else alone.push(m);
    }
    return { byRegion: [...groups.values()], single: alone };
  }, [data]);

  const areaName = (r: { nameAr: string; nameEn: string }) =>
    locale === "ar" ? r.nameAr : r.nameEn;

  async function start() {
    if (!data || data.ready.length === 0) return;
    setStarting(true);
    setError(null);
    try {
      const ids = data.ready.map((r) => r.orderId);
      const chosen = Object.fromEntries(
        Object.entries(addresses).filter(([id]) => ids.includes(id)),
      );
      const batch = await shipmentBatchStart(apiClient, workspaceId, {
        carrierCode,
        orderIds: ids,
        addresses: chosen,
      });
      toast.success(fmt(t.started, { count: ids.length, name }));
      onStarted();
      navigate(`/orders/shipment-batches/${batch.id}`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setStarting(false);
    }
  }

  const fail = (err: unknown) => setError(errorMessage(err));

  return (
    <Modal
      open
      onClose={() => (starting ? undefined : onClose())}
      title={fmt(t.title, { count: orderIds.length, name })}
      className="max-w-2xl"
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={onClose}
            disabled={starting}
          >
            {t.cancel}
          </Button>
          <Button
            type="button"
            className="min-h-11"
            onClick={start}
            disabled={
              starting || preview.loading || !data || data.ready.length === 0
            }
          >
            {starting
              ? t.booking
              : fmt(t.book, { count: data?.ready.length ?? 0 })}
          </Button>
        </>
      }
    >
      <DataState
        loading={preview.loading && !data}
        error={preview.error}
        onRetry={() => void preview.refresh()}
      >
        {data && (
          <div className="space-y-4">
            {error && (
              <Alert variant="danger" role="alert">
                {error}
              </Alert>
            )}
            <p className="text-sm text-ink">
              {fmt(t.summary, {
                ready: data.ready.length,
                missing: data.missing.length,
                blocked: data.blocked.length,
              })}
            </p>

            {data.ready.length > 0 ? (
              <section>
                <h3 className="text-sm font-semibold text-success">
                  {t.readyTitle} ({data.ready.length})
                </h3>
                <p className="text-sm text-ink-soft">
                  {fmt(t.readyHint, { name })}
                </p>
              </section>
            ) : (
              <p className="text-sm text-ink-soft">{t.nothingReady}</p>
            )}

            {data.missing.length > 0 && (
              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-danger">
                  {fmt(t.missingTitle, { name })} ({data.missing.length})
                </h3>
                <ul className="max-h-[40vh] divide-y divide-line overflow-y-auto pe-1">
                  {byRegion.map((group) => {
                    const region = group[0].region!;
                    const key = `region:${region.code}`;
                    return (
                      <li key={key} className="py-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm text-ink">
                              {fmt(t.regionGroup, {
                                area: areaName(region),
                                count: group.length,
                              })}
                            </p>
                            <p className="text-xs text-ink-soft">
                              {fmt(t.regionHint, { area: areaName(region) })}
                            </p>
                          </div>
                          {fixing !== key && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => setFixing(key)}
                            >
                              {t.choose}
                            </Button>
                          )}
                        </div>
                        {fixing === key && (
                          <CourierPlacePicker
                            carrierCode={carrierCode}
                            name={name}
                            levels={data.levels}
                            onCancel={() => setFixing(null)}
                            onError={fail}
                            onSave={async (path, place) => {
                              await carrierRegionSet(
                                apiClient,
                                workspaceId,
                                carrierCode,
                                region.code,
                                path,
                              );
                              toast.success(
                                fmt(t.regionSaved, {
                                  area: areaName(region),
                                  place,
                                  name,
                                }),
                              );
                              setFixing(null);
                              await preview.refresh({ silent: true });
                            }}
                          />
                        )}
                      </li>
                    );
                  })}
                  {single.map((m) => {
                    const key = `order:${m.orderId}`;
                    return (
                      <li key={key} className="py-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm text-ink">
                              <bdi dir="ltr" className="font-medium">
                                {m.orderNumber}
                              </bdi>{" "}
                              <span className="text-ink-soft">
                                {fmt(t.orderAddress, {
                                  province: m.province ?? "—",
                                  city: m.city ?? "—",
                                })}
                              </span>
                            </p>
                            <p className="text-xs text-ink-soft">
                              {t.orderHint}
                            </p>
                          </div>
                          {fixing !== key && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => setFixing(key)}
                            >
                              {t.choose}
                            </Button>
                          )}
                        </div>
                        {fixing === key && (
                          <CourierPlacePicker
                            carrierCode={carrierCode}
                            name={name}
                            levels={data.levels}
                            onCancel={() => setFixing(null)}
                            onError={fail}
                            onSave={async (path, place) => {
                              toast.success(
                                fmt(t.orderSaved, {
                                  order: m.orderNumber,
                                  place,
                                }),
                              );
                              setFixing(null);
                              setAddresses((prev) => ({
                                ...prev,
                                [m.orderId]: { path },
                              }));
                            }}
                          />
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            {data.blocked.length > 0 && (
              <section className="space-y-1">
                <h3 className="text-sm font-semibold text-ink">
                  {t.blockedTitle} ({data.blocked.length})
                </h3>
                <ul className="max-h-40 space-y-1 overflow-y-auto text-sm">
                  {data.blocked.map((b) => (
                    <li key={b.orderId} className="flex flex-wrap gap-2">
                      <bdi dir="ltr" className="font-medium text-ink">
                        {b.orderNumber ?? b.orderId}
                      </bdi>
                      <span className="text-ink-soft">
                        {errorMessage({ code: b.code, message: b.message })}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </DataState>
    </Modal>
  );
}
