import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Alert, Button } from "@store-builder/ui";
import {
  shipmentBatchGet,
  shipmentBatchRetry,
  type ShipmentBatchAddresses,
  type ShipmentBatchItem,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { fmt, useT } from "@/i18n/LocaleContext";
import { DataState } from "@/components/DataState";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { CourierPlacePicker } from "@/pages/shipping/CourierPlacePicker";
import { useOrderErrorMessage } from "./orderErrors";

const STRINGS = {
  en: {
    title: "Shipping with {name}",
    back: "Orders",
    queued: "Waiting to start…",
    running: "Booking orders one by one…",
    done: "Finished",
    counts:
      "{booked} booked · {failed} not booked · {pending} waiting, of {total}",
    order: "Order",
    status: "Status",
    waybill: "Waybill",
    reason: "Reason",
    s_pending: "Waiting",
    s_booking: "Booking",
    s_booked: "Booked",
    s_failed: "Not booked",
    choose: "Choose area",
    placeChosen: "Goes to {place}",
    retry: "Send {count} again",
    retrying: "Sending…",
    retried: "Sending {count} orders to {name} again.",
    retryHint:
      "Nothing is sent again on its own. Fix the reason (an area, a confirmation) and send the failed orders again.",
    notes: "Notes for the courier: {notes}",
  },
  ar: {
    title: "الشحن مع {name}",
    back: "الطلبات",
    queued: "في انتظار البدء…",
    running: "جارٍ حجز الطلبات واحدًا تلو الآخر…",
    done: "انتهى",
    counts:
      "{booked} تم حجزه · {failed} لم يُحجز · {pending} في الانتظار، من {total}",
    order: "الطلب",
    status: "الحالة",
    waybill: "رقم البوليصة",
    reason: "السبب",
    s_pending: "في الانتظار",
    s_booking: "جارٍ الحجز",
    s_booked: "تم الحجز",
    s_failed: "لم يُحجز",
    choose: "اختيار المنطقة",
    placeChosen: "سيُشحن إلى {place}",
    retry: "إعادة إرسال {count}",
    retrying: "جارٍ الإرسال…",
    retried: "جارٍ إعادة إرسال {count} طلب إلى {name}.",
    retryHint:
      "لا يُعاد إرسال أي طلب تلقائيًا. عالج السبب (منطقة، تأكيد) ثم أعد إرسال الطلبات التي لم تُحجز.",
    notes: "ملاحظات للمندوب: {notes}",
  },
};

const TONE: Record<
  ShipmentBatchItem["status"],
  "neutral" | "info" | "success" | "danger"
> = {
  pending: "neutral",
  booking: "info",
  booked: "success",
  failed: "danger",
};

/** One "Ship selected" batch: live progress, each order's result, and sending the failed ones again. */
export function ShipmentBatchPage() {
  const t = useT(STRINGS);
  const { batchId = "" } = useParams();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useOrderErrorMessage();
  const batch = useAsync(
    () => shipmentBatchGet(apiClient, workspaceId, batchId),
    [workspaceId, batchId],
  );
  const carriers = useAsync(
    () => apiClient.listCarriers(workspaceId),
    [workspaceId],
  );
  const [addresses, setAddresses] = useState<ShipmentBatchAddresses>({});
  const [places, setPlaces] = useState<Record<string, string>>({});
  const [fixing, setFixing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const data = batch.data;
  const running = data ? data.status !== "done" : false;
  const { refresh } = batch;
  // Live while the queue works on it.
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => void refresh({ silent: true }), 2000);
    return () => window.clearInterval(id);
  }, [running, refresh]);

  const courier = carriers.data?.carriers.find(
    (c) => c.code === data?.carrierCode,
  );
  const name = courier?.name ?? data?.carrierCode ?? "";
  const levels = courier?.capabilities?.addressLevels ?? [];
  const failed = (data?.items ?? []).filter((i) => i.status === "failed");

  async function retry() {
    setBusy(true);
    setError(null);
    try {
      await shipmentBatchRetry(apiClient, workspaceId, batchId, { addresses });
      toast.success(fmt(t.retried, { count: failed.length, name }));
      setAddresses({});
      setPlaces({});
      await batch.refresh({ silent: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title={fmt(t.title, { name })}
        back={{ to: "/orders", label: t.back }}
        description={
          data
            ? data.status === "done"
              ? t.done
              : data.status === "running"
                ? t.running
                : t.queued
            : undefined
        }
        actions={
          data?.status === "done" && failed.length > 0 ? (
            <Button className="min-h-11" onClick={retry} disabled={busy}>
              {busy ? t.retrying : fmt(t.retry, { count: failed.length })}
            </Button>
          ) : undefined
        }
      />
      <DataState
        loading={batch.loading && !data}
        error={batch.error}
        onRetry={() => void batch.refresh()}
      >
        {data && (
          <div className="space-y-4">
            {error && (
              <Alert variant="danger" role="alert">
                {error}
              </Alert>
            )}
            <p className="text-sm text-ink">
              {fmt(t.counts, { ...data.counts })}
            </p>
            {data.notes && (
              <p className="text-sm text-ink-soft">
                {fmt(t.notes, { notes: data.notes })}
              </p>
            )}
            {failed.length > 0 && data.status === "done" && (
              <p className="text-sm text-ink-soft">{t.retryHint}</p>
            )}
            <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line">
              <table className="w-full text-sm">
                <thead className="bg-paper text-start text-xs text-ink-soft">
                  <tr>
                    <th className="px-3 py-2 text-start font-medium">
                      {t.order}
                    </th>
                    <th className="px-3 py-2 text-start font-medium">
                      {t.status}
                    </th>
                    <th className="px-3 py-2 text-start font-medium">
                      {t.waybill}
                    </th>
                    <th className="px-3 py-2 text-start font-medium">
                      {t.reason}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {(data.items ?? []).map((item) => (
                    <tr key={item.orderId} className="align-top">
                      <td className="px-3 py-2">
                        <Link
                          to={`/orders/${item.orderId}`}
                          className="font-medium text-primary hover:underline"
                        >
                          <bdi dir="ltr">
                            {item.orderNumber ?? item.orderId}
                          </bdi>
                        </Link>
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge
                          value={item.status}
                          tone={TONE[item.status]}
                          text={t[`s_${item.status}`]}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <bdi dir="ltr" className="whitespace-nowrap">
                          {item.waybillNumber ?? "—"}
                        </bdi>
                      </td>
                      <td className="px-3 py-2 text-ink-soft">
                        {item.status === "failed" && (
                          <>
                            <span>
                              {errorMessage({
                                code: item.errorCode ?? "",
                                message: item.errorMessage ?? "",
                              })}
                            </span>
                            {item.errorCode === "CARRIER_ADDRESS_UNMATCHED" &&
                              data.status === "done" &&
                              levels.length > 0 && (
                                <div className="mt-1">
                                  {places[item.orderId] && (
                                    <p className="text-xs text-success">
                                      {fmt(t.placeChosen, {
                                        place: places[item.orderId],
                                      })}
                                    </p>
                                  )}
                                  {fixing === item.orderId ? (
                                    <CourierPlacePicker
                                      carrierCode={data.carrierCode}
                                      name={name}
                                      levels={levels}
                                      initialPath={
                                        addresses[item.orderId]?.path ?? []
                                      }
                                      onCancel={() => setFixing(null)}
                                      onError={(err) =>
                                        setError(errorMessage(err))
                                      }
                                      onSave={async (path, place) => {
                                        setAddresses((prev) => ({
                                          ...prev,
                                          [item.orderId]: { path },
                                        }));
                                        setPlaces((prev) => ({
                                          ...prev,
                                          [item.orderId]: place,
                                        }));
                                        setFixing(null);
                                      }}
                                    />
                                  ) : (
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      onClick={() => setFixing(item.orderId)}
                                    >
                                      {t.choose}
                                    </Button>
                                  )}
                                </div>
                              )}
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </DataState>
    </div>
  );
}
