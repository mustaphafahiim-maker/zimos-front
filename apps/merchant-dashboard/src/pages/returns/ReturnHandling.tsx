import { useEffect, useId, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Alert, Button, Input } from "@store-builder/ui";
import {
  apiErrorCode,
  apiErrorDetails,
  carrierReturnPickup,
  isApiErrorCode,
  returnCancel,
  returnCaseOf,
  returnPickupBook,
  returnPickupCancel,
  returnPickupIsLive,
  returnPickupStatusOf,
  returnPickupSync,
  type CarrierAddressUnmatchedDetails,
  type CarrierInfo,
  type Order,
  type Product,
  type ReturnPickupStatus,
  type ReturnRequest,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useCarrierErrorMessage, useErrorMessage } from "@/lib/errorMessages";
import { formatDateTime } from "@/lib/format";
import { providerName } from "@/lib/providers";
import { fmt, useCommon, useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { useWorkspace } from "@/context/WorkspaceContext";
import { Field } from "@/components/Field";
import { Modal } from "@/components/Modal";
import { Select } from "@/components/Select";
import { StatusBadge } from "@/components/StatusBadge";
import { Textarea } from "@/components/Textarea";
import { useToast } from "@/components/Toast";
import { CityDistrictPicker, type PickerSource } from "@/pages/orders/components/CarrierAddressPicker";
import { usesCityDistrict } from "@/pages/shipping/carriers";

/** System roles holding orders.manage. */
const MANAGE_ROLES: ReadonlySet<string> = new Set(["owner", "workspace_manager", "order_operator"]);

const STRINGS = {
  en: {
    exchange: "Exchange",
    noteToCustomer: "Message to the customer: {note}",
    openReplacement: "Open replacement order",
    pickup: "Courier pickup",
    pickupWith: "{carrier} · waybill {waybill}",
    pickupManual: "Booked elsewhere",
    pickup_requested: "Waiting for courier",
    pickup_picked_up: "Picked up",
    pickup_in_transit: "On its way back",
    pickup_returned_to_merchant: "Back at the store",
    pickup_failed: "Pickup failed",
    pickup_cancelled: "Cancelled",
    statusSince: "since {date}",
    track: "Track",
    refresh: "Refresh status",
    refreshing: "Refreshing…",
    refreshed: "Pickup status updated.",
    book: "Book courier pickup",
    bookAgain: "Book again",
    bookTitle: "Book a courier to collect this return",
    bookIntro: "The courier collects the parcel from the customer's address.",
    courier: "Who collects it?",
    elsewhere: "Booked elsewhere",
    elsewhereHint: "You booked the pickup outside ZIMOS: record its waybill here.",
    waybill: "Waybill number",
    waybillRequired: "Type the waybill number.",
    notes: "Note for the courier",
    bookSubmit: "Book pickup",
    recordSubmit: "Record pickup",
    booking: "Booking…",
    booked: "Pickup booked. Waybill {waybill}.",
    failedFirst: "This pickup failed — cancel it first, then book again",
    cancelPickup: "Cancel pickup",
    cancelPickupTitle: "Cancel this pickup?",
    cancelPickupBody: "We'll cancel the pickup with the courier",
    cancelPickupConfirm: "Cancel pickup",
    pickupCancelled: "Pickup cancelled. You can book again.",
    cancelReturn: "Cancel return",
    cancelReturnTitle: "Cancel this return?",
    cancelReturnBody: "The return closes without a refund or a restock. A booked pickup is cancelled with the courier first.",
    cancelReturnConfirm: "Cancel return",
    cancelNote: "Note (optional)",
    returnCancelled: "Return cancelled.",
    myself: "I cancelled it with the courier myself",
    keep: "Keep it",
    working: "Cancelling…",
  },
  ar: {
    exchange: "استبدال",
    noteToCustomer: "رسالة للعميل: {note}",
    openReplacement: "فتح طلب الاستبدال",
    pickup: "استلام المندوب",
    pickupWith: "{carrier} · بوليصة {waybill}",
    pickupManual: "اتحجز بره زيمّوس",
    pickup_requested: "مستني المندوب",
    pickup_picked_up: "المندوب استلم",
    pickup_in_transit: "في الطريق للمتجر",
    pickup_returned_to_merchant: "وصل المتجر",
    pickup_failed: "فشل الاستلام",
    pickup_cancelled: "اتلغى",
    statusSince: "من {date}",
    track: "تتبّع",
    refresh: "تحديث الحالة",
    refreshing: "بنحدّث…",
    refreshed: "حالة الاستلام اتحدّثت.",
    book: "احجز مندوب لاستلام المرتجع",
    bookAgain: "احجز مندوب تاني",
    bookTitle: "احجز مندوب يستلم المرتجع ده",
    bookIntro: "المندوب هيستلم الشحنة من عنوان العميل.",
    courier: "مين هيستلمه؟",
    elsewhere: "اتحجز بره زيمّوس",
    elsewhereHint: "حجزت الاستلام بره زيمّوس: سجّل رقم البوليصة هنا.",
    waybill: "رقم البوليصة",
    waybillRequired: "اكتب رقم البوليصة.",
    notes: "ملاحظة للمندوب",
    bookSubmit: "احجز المندوب",
    recordSubmit: "سجّل الاستلام",
    booking: "بنحجز…",
    booked: "اتحجز المندوب. رقم البوليصة {waybill}.",
    failedFirst: "الاستلام ده فشل — الغيه الأول وبعدين احجز تاني",
    cancelPickup: "إلغاء المندوب",
    cancelPickupTitle: "تلغي الاستلام ده؟",
    cancelPickupBody: "هنلغي الاستلام عند شركة الشحن",
    cancelPickupConfirm: "إلغاء المندوب",
    pickupCancelled: "اتلغى الاستلام. تقدر تحجز تاني.",
    cancelReturn: "إلغاء المرتجع",
    cancelReturnTitle: "تلغي المرتجع ده؟",
    cancelReturnBody: "المرتجع هيتقفل من غير استرداد ولا رجوع للمخزون. لو فيه مندوب محجوز هيتلغي عند شركة الشحن الأول.",
    cancelReturnConfirm: "إلغاء المرتجع",
    cancelNote: "ملاحظة (اختياري)",
    returnCancelled: "اتلغى المرتجع.",
    myself: "لغيته بنفسي عند شركة الشحن",
    keep: "سيبه",
    working: "بنلغي…",
  },
} satisfies Messages;

type Strings = Record<keyof typeof STRINGS.en, string>;

const MANUAL = "manual";
/** Isolates an LTR run (a waybill) inside plain text, where <bdi> can't go. */
const isolate = (value: string) => `⁦${value}⁩`;

const PICKUP_TONE: Record<ReturnPickupStatus, "warning" | "info" | "success" | "danger" | "neutral"> = {
  requested: "warning",
  picked_up: "info",
  in_transit: "info",
  returned_to_merchant: "success",
  failed: "danger",
  cancelled: "neutral",
};

function pickupLabel(t: Strings, status: ReturnPickupStatus): string {
  return t[`pickup_${status}` as keyof Strings] ?? status;
}

// One read of the couriers per store and visit: every return card asks the same question.
const carriersCache = new Map<string, Promise<CarrierInfo[]>>();
function loadCarriers(workspaceId: string): Promise<CarrierInfo[]> {
  let pending = carriersCache.get(workspaceId);
  if (!pending) {
    pending = apiClient
      .listCarriers(workspaceId)
      .then((list) => list.carriers ?? [])
      .catch(() => []);
    carriersCache.set(workspaceId, pending);
    window.setTimeout(() => carriersCache.delete(workspaceId), 60_000);
  }
  return pending;
}

function useCarriers(enabled: boolean): CarrierInfo[] {
  const workspaceId = useWorkspaceId();
  const [carriers, setCarriers] = useState<CarrierInfo[]>([]);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    void loadCarriers(workspaceId).then((list) => {
      if (alive) setCarriers(list);
    });
    return () => {
      alive = false;
    };
  }, [workspaceId, enabled]);
  return carriers;
}

// The products behind an exchange's lines, for the options of the variant asked for.
const productCache = new Map<string, Promise<Product | null>>();
function loadProduct(workspaceId: string, productId: string): Promise<Product | null> {
  const key = `${workspaceId}:${productId}`;
  let pending = productCache.get(key);
  if (!pending) {
    pending = apiClient.getProduct(workspaceId, productId).catch(() => null);
    productCache.set(key, pending);
  }
  return pending;
}

const optionsOf = (values: Record<string, string> | null | undefined) => (values ? Object.values(values).filter(Boolean).join(" / ") : "");

/** «M → L» for every line of an exchange: what the customer has → what they asked for instead. */
function useExchangeSwaps(ret: ReturnRequest, order: Order | null | undefined): Record<string, { from: string; to: string }> {
  const workspaceId = useWorkspaceId();
  const lines = returnCaseOf(ret).items.filter((line) => line.exchangeVariantId);
  const key = lines.map((l) => `${l.orderItemId}:${l.exchangeVariantId}`).join(",");
  const [swaps, setSwaps] = useState<Record<string, { from: string; to: string }>>({});

  useEffect(() => {
    if (!order || lines.length === 0) return;
    let alive = true;
    void Promise.all(
      lines.map(async (line) => {
        const item = order.items.find((i) => i.id === line.orderItemId);
        if (!item?.productId) return null;
        const product = await loadProduct(workspaceId, item.productId);
        const variant = product?.variants?.find((v) => v.id === line.exchangeVariantId);
        if (!variant) return null;
        return [line.orderItemId, { from: optionsOf(item.variantOptionsSnapshot), to: optionsOf(variant.optionValues) }] as const;
      })
    ).then((found) => {
      if (alive) setSwaps(Object.fromEntries(found.filter((entry) => entry !== null)));
    });
    return () => {
      alive = false;
    };
    // `key` stands for the lines; the order's items do not change under a return.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, key, order?.id]);

  return swaps;
}

/** «استبدال» among a return's chips when the customer wants another size or colour instead of a refund. */
export function ReturnExchangeBadge({ ret }: { ret: ReturnRequest }) {
  const t = useT(STRINGS);
  if (returnCaseOf(ret).resolution !== "exchange") return null;
  return <StatusBadge value="exchange" tone="info" text={t.exchange} />;
}

/** Where the booked pickup stands, as a chip for the queue's row. Nothing without a pickup. */
export function ReturnPickupBadge({ ret }: { ret: ReturnRequest }) {
  const t = useT(STRINGS);
  const status = returnPickupStatusOf(returnCaseOf(ret).pickup);
  if (!status) return null;
  return <StatusBadge value={`pickup_${status}`} tone={PICKUP_TONE[status]} text={pickupLabel(t, status)} />;
}

export interface ReturnHandlingProps {
  ret: ReturnRequest;
  /** The order behind the return, when it has arrived: names the exchange's sizes and prices the dialog's currency. */
  order?: Order | null;
  /** The server's answer after a pickup was booked, synced or cancelled, or the return cancelled. */
  onUpdated: (updated: ReturnRequest) => void;
  className?: string;
}

/**
 * What a return carries beyond approve / reject / restock (handoff 372, 396):
 * the exchange it asks for («M → L»), the message the customer was sent, the
 * replacement order, the courier pickup — its status, refresh, cancel, book
 * again — and "Cancel return". Used on the returns queue's preview and on the
 * order page's Returns card.
 */
export function ReturnHandling({ ret, order, onUpdated, className }: ReturnHandlingProps) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const { currentWorkspace } = useWorkspace();
  const canManage = MANAGE_ROLES.has(currentWorkspace?.role ?? "");
  const { dir } = useLocale();

  const data = returnCaseOf(ret);
  const pickup = data.pickup ?? null;
  const pickupStatus = returnPickupStatusOf(pickup);
  const exchange = data.resolution === "exchange";
  const livePickup = returnPickupIsLive(pickup);
  const canBook = canManage && ret.status === "approved" && !ret.restockedAt && !livePickup;
  const canCancelReturn = canManage && (ret.status === "requested" || ret.status === "approved") && !ret.restockedAt;
  const carriers = useCarriers(canManage && (canBook || Boolean(pickup)));
  const swaps = useExchangeSwaps(ret, order);

  const [syncing, setSyncing] = useState(false);
  const [booking, setBooking] = useState(false);
  const [cancelling, setCancelling] = useState<"pickup" | "return" | null>(null);

  const pickupCarrier = pickup ? carriers.find((c) => c.code === pickup.carrierCode) : undefined;
  const pickupName = pickup ? (pickup.carrierCode === MANUAL ? t.pickupManual : (pickupCarrier?.name ?? providerName(pickup.carrierCode))) : "";
  const canSync = canManage && livePickup && pickup?.carrierCode !== MANUAL && carrierReturnPickup(pickupCarrier).status;
  const canCancelPickup = canManage && (pickupStatus === "requested" || pickupStatus === "failed");

  async function sync() {
    setSyncing(true);
    try {
      onUpdated(await returnPickupSync(apiClient, workspaceId, ret.id));
      toast.success(t.refreshed);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSyncing(false);
    }
  }

  const exchangeLines = exchange ? data.items.filter((line) => swaps[line.orderItemId]) : [];
  const nothing = !exchange && !data.decisionNote && !data.exchangeOrderId && !pickup && !canBook && !canCancelReturn;
  if (nothing) return null;

  return (
    <div data-slot="return-handling" className={className ?? "mt-2 space-y-2 text-sm"}>
      {exchangeLines.length > 0 && (
        <ul className="space-y-0.5 text-xs text-ink-soft">
          {exchangeLines.map((line) => {
            const item = order?.items.find((i) => i.id === line.orderItemId);
            const swap = swaps[line.orderItemId];
            return (
              <li key={line.orderItemId} className="flex flex-wrap items-center gap-x-1.5">
                {item && <bdi className="text-ink">{item.productNameSnapshot}</bdi>}
                {/* Each side keeps its own direction; the arrow follows the reading direction. */}
                <span className="inline-flex items-center gap-1 font-semibold text-ink">
                  <bdi>{swap.from || "—"}</bdi>
                  <span aria-hidden>{dir === "rtl" ? "←" : "→"}</span>
                  <bdi>{swap.to || "—"}</bdi>
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {data.decisionNote && (
        <p dir="auto" className="rounded-xl bg-paper-sunken px-3 py-2 text-xs leading-5 text-ink">
          {fmt(t.noteToCustomer, { note: data.decisionNote })}
        </p>
      )}

      {data.exchangeOrderId && (
        <Link to={`/orders/${data.exchangeOrderId}`} className="inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline pointer-fine:min-h-8">
          {t.openReplacement}
        </Link>
      )}

      {pickup && pickupStatus && (
        <div data-slot="return-pickup" className="rounded-[0.5rem] border border-line px-3 py-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="min-w-0 text-xs text-ink-soft">
              <span className="font-medium text-ink">{t.pickup}</span>
              {" · "}
              {pickup.carrierCode === MANUAL ? (
                <>
                  {t.pickupManual}
                  {pickup.waybillNumber && (
                    <>
                      {" · "}
                      <bdi dir="ltr">{pickup.waybillNumber}</bdi>
                    </>
                  )}
                </>
              ) : (
                fmt(t.pickupWith, { carrier: pickupName, waybill: isolate(pickup.waybillNumber ?? "—") })
              )}
            </p>
            <StatusBadge value={`pickup_${pickupStatus}`} tone={PICKUP_TONE[pickupStatus]} text={pickupLabel(t, pickupStatus)} />
          </div>
          {(pickup.carrierStatus?.value || pickup.statusAt) && (
            <p className="mt-0.5 text-xs text-ink-soft">
              {pickup.carrierStatus?.value && <bdi>{pickup.carrierStatus.value}</bdi>}
              {pickup.carrierStatus?.value && pickup.statusAt && " · "}
              {pickup.statusAt && fmt(t.statusSince, { date: formatDateTime(pickup.statusAt) })}
            </p>
          )}
          {(pickup.trackingUrl || canSync || canCancelPickup) && (
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              {pickup.trackingUrl && (
                <a href={pickup.trackingUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center px-1 text-sm font-medium text-primary hover:underline">
                  {t.track}
                </a>
              )}
              {canSync && (
                <Button type="button" variant="outline" size="sm" className="min-h-11" disabled={syncing} onClick={() => void sync()}>
                  {syncing ? t.refreshing : t.refresh}
                </Button>
              )}
              {canCancelPickup && (
                <Button type="button" variant="ghost" size="sm" className="min-h-11 text-danger hover:bg-danger-soft" onClick={() => setCancelling("pickup")}>
                  {t.cancelPickup}
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {(canBook || canCancelReturn) && (
        <div className="flex flex-wrap items-center gap-2">
          {canBook && (
            <Button type="button" variant="outline" size="sm" className="min-h-11" onClick={() => setBooking(true)}>
              {pickup ? t.bookAgain : t.book}
            </Button>
          )}
          {canCancelReturn && (
            <Button type="button" variant="ghost" size="sm" className="min-h-11 text-danger hover:bg-danger-soft" onClick={() => setCancelling("return")}>
              {t.cancelReturn}
            </Button>
          )}
        </div>
      )}

      {booking && (
        <PickupDialog
          ret={ret}
          carriers={carriers}
          onClose={() => setBooking(false)}
          onBooked={(updated) => {
            setBooking(false);
            onUpdated(updated);
            const waybill = returnCaseOf(updated).pickup?.waybillNumber;
            toast.success(fmt(t.booked, { waybill: isolate(waybill ?? "—") }));
          }}
        />
      )}
      {cancelling && (
        <CancelDialog
          ret={ret}
          mode={cancelling}
          onClose={() => setCancelling(null)}
          onDone={(updated) => {
            toast.success(cancelling === "pickup" ? t.pickupCancelled : t.returnCancelled);
            setCancelling(null);
            onUpdated(updated);
          }}
        />
      )}
    </div>
  );
}

function PickupDialog({
  ret,
  carriers,
  onClose,
  onBooked,
}: {
  ret: ReturnRequest;
  carriers: CarrierInfo[];
  onClose: () => void;
  onBooked: (updated: ReturnRequest) => void;
}) {
  const t = useT(STRINGS);
  const common = useCommon();
  const workspaceId = useWorkspaceId();
  const carrierError = useCarrierErrorMessage();
  const formId = useId();
  // Connected couriers that collect returns through ZIMOS; anything else is booked with them and recorded.
  const able = carriers.filter((c) => c.connection && carrierReturnPickup(c).book);
  const [method, setMethod] = useState<string>(able[0]?.code ?? MANUAL);
  const [waybill, setWaybill] = useState("");
  const [notes, setNotes] = useState("");
  const [picker, setPicker] = useState<PickerSource | null>(null);
  const [cityId, setCityId] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [waybillError, setWaybillError] = useState<string | undefined>(undefined);

  // The couriers may land after the dialog opened: take the first one then, unless the merchant already chose.
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (!touched && able[0]) setMethod(able[0].code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [able.length]);

  const courier = method === MANUAL ? undefined : able.find((c) => c.code === method);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setWaybillError(undefined);
    if (!courier && !waybill.trim()) {
      setWaybillError(t.waybillRequired);
      return;
    }
    setBusy(true);
    try {
      const updated = await returnPickupBook(
        apiClient,
        workspaceId,
        ret.id,
        courier
          ? {
              carrierCode: courier.code,
              ...(picker && cityId && districtId ? { carrierAddress: { cityId, districtId } } : {}),
              ...(notes.trim() ? { notes: notes.trim() } : {}),
            }
          : { carrierCode: MANUAL, waybillNumber: waybill.trim() }
      );
      onBooked(updated);
    } catch (err) {
      if (apiErrorCode(err) === "RETURN_PICKUP_EXISTS" && apiErrorDetails<{ pickupStatus?: string }>(err)?.pickupStatus === "failed") {
        setError(t.failedFirst);
      } else if (courier && usesCityDistrict(courier) && isApiErrorCode(err, "CARRIER_ADDRESS_UNMATCHED")) {
        const details = apiErrorDetails<CarrierAddressUnmatchedDetails>(err);
        if (details) {
          setPicker({ kind: "unmatched", details });
          setCityId(details.level === "district" && details.matchedCity ? details.matchedCity.id : "");
          setDistrictId("");
        }
        setError(carrierError(err, courier));
      } else {
        setError(carrierError(err, courier ?? null));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={() => {
        if (!busy) onClose();
      }}
      title={t.bookTitle}
      description={t.bookIntro}
      footer={
        <>
          <Button type="button" variant="outline" className="rounded-full px-5" disabled={busy} onClick={onClose}>
            {common.cancel}
          </Button>
          <Button type="submit" form={formId} className="rounded-full px-5" disabled={busy}>
            {busy ? t.booking : courier ? t.bookSubmit : t.recordSubmit}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} noValidate className="space-y-4">
        {error && (
          <Alert variant="danger" role="alert">
            {error}
          </Alert>
        )}
        <Field label={t.courier} hint={courier ? undefined : t.elsewhereHint}>
          {({ id }) => (
            <Select
              id={id}
              value={method}
              disabled={busy}
              onChange={(e) => {
                setTouched(true);
                setMethod(e.target.value);
                setPicker(null);
                setError(null);
              }}
              className="h-11"
            >
              {able.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
              <option value={MANUAL}>{t.elsewhere}</option>
            </Select>
          )}
        </Field>

        {courier ? (
          <>
            {picker && (
              <CityDistrictPicker
                courier={courier}
                source={picker as Extract<PickerSource, { kind: "free" | "unmatched" }>}
                cityId={cityId}
                districtId={districtId}
                onCityChange={(next) => {
                  setCityId(next);
                  setDistrictId("");
                }}
                onDistrictChange={setDistrictId}
                disabled={busy}
              />
            )}
            <Field label={t.notes}>
              {({ id, ...aria }) => (
                <Input id={id} {...aria} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} dir="auto" className="h-11" disabled={busy} />
              )}
            </Field>
          </>
        ) : (
          <Field label={t.waybill} error={waybillError} required>
            {({ id, ...aria }) => (
              <Input
                id={id}
                {...aria}
                value={waybill}
                onChange={(e) => {
                  setWaybill(e.target.value);
                  setWaybillError(undefined);
                }}
                maxLength={100}
                dir="ltr"
                className="h-11"
                disabled={busy}
              />
            )}
          </Field>
        )}
      </form>
    </Modal>
  );
}

/** Cancels the booked pickup, or the whole return (its live pickup first). */
function CancelDialog({
  ret,
  mode,
  onClose,
  onDone,
}: {
  ret: ReturnRequest;
  mode: "pickup" | "return";
  onClose: () => void;
  onDone: (updated: ReturnRequest) => void;
}) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const errorMessage = useErrorMessage();
  const noteId = useId();
  const [note, setNote] = useState("");
  // Asked for only after the server said the courier has to be told by hand.
  const [needsWord, setNeedsWord] = useState(false);
  const [myself, setMyself] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      const options = myself ? { acknowledgeManualCancel: true } : {};
      const updated =
        mode === "pickup"
          ? await returnPickupCancel(apiClient, workspaceId, ret.id, options)
          : await returnCancel(apiClient, workspaceId, ret.id, { ...options, ...(note.trim() ? { note: note.trim().slice(0, 500) } : {}) });
      onDone(updated);
    } catch (err) {
      if (apiErrorCode(err) === "RETURN_PICKUP_MANUAL_CANCEL_REQUIRED") setNeedsWord(true);
      // The courier's own refusal is the useful part of RETURN_PICKUP_CANCEL_FAILED.
      const own = apiErrorCode(err) === "RETURN_PICKUP_CANCEL_FAILED" && err instanceof Error && err.message ? err.message : null;
      setError(own ?? errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={() => {
        if (!busy) onClose();
      }}
      title={mode === "pickup" ? t.cancelPickupTitle : t.cancelReturnTitle}
      description={mode === "pickup" ? t.cancelPickupBody : t.cancelReturnBody}
      footer={
        <>
          <Button type="button" variant="outline" className="rounded-full px-5" disabled={busy} onClick={onClose}>
            {t.keep}
          </Button>
          <Button type="button" variant="danger" className="rounded-full px-5" disabled={busy || (needsWord && !myself)} onClick={() => void confirm()}>
            {busy ? t.working : mode === "pickup" ? t.cancelPickupConfirm : t.cancelReturnConfirm}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {error && (
          <Alert variant="danger" role="alert">
            <span dir="auto">{error}</span>
          </Alert>
        )}
        {needsWord && (
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium text-ink">
            <input type="checkbox" className="size-5 shrink-0 cursor-pointer accent-primary" checked={myself} disabled={busy} onChange={(e) => setMyself(e.target.checked)} />
            {t.myself}
          </label>
        )}
        {mode === "return" && (
          <div className="space-y-1.5">
            <label htmlFor={noteId} className="block text-sm font-medium text-ink">
              {t.cancelNote}
            </label>
            <Textarea id={noteId} value={note} maxLength={500} dir="auto" rows={2} disabled={busy} onChange={(e) => setNote(e.target.value)} />
          </div>
        )}
      </div>
    </Modal>
  );
}
