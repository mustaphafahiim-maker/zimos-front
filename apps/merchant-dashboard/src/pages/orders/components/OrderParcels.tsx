import { useEffect, useId, useMemo, useState, type FormEvent } from "react";
import { Alert, Button, Input } from "@store-builder/ui";
import {
  apiErrorCode,
  apiErrorDetails,
  apiFieldProblems,
  isApiErrorCode,
  parcelCodOf,
  parcelCreate,
  parcelItemsOf,
  parcelMaxCodOf,
  parcelPlan,
  parcelWaybillPdf,
  type CarrierAddressUnmatchedDetails,
  type CarrierInfo,
  type Order,
  type ParcelItem,
  type ParcelPlan,
  type ParcelPlanLine,
  type Shipment,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useCarrierErrorMessage, useErrorMessage } from "@/lib/errorMessages";
import { formatDate, formatMoney, majorToMinor, minorToMajorInput } from "@/lib/format";
import { fmt, useCommon, useT, type Messages } from "@/i18n/LocaleContext";
import { Field } from "@/components/Field";
import { IconMinus, IconPlus, IconPrint } from "@/components/icons";
import { Modal } from "@/components/Modal";
import { MoneyInput } from "@/components/MoneyInput";
import { Select } from "@/components/Select";
import { useToast } from "@/components/Toast";
import { FINISHED_SHIPMENT_STATUSES, usesCityDistrict } from "@/pages/shipping/carriers";
import { CityDistrictPicker, type PickerSource } from "./CarrierAddressPicker";

const STRINGS = {
  en: {
    parcelOf: "Parcel {n} of {total}",
    collect: "Collect {amount}",
    printWaybill: "Print waybill",
    preparing: "Preparing…",
    leftNote_one: "1 unit not shipped yet",
    leftNote_other: "{n} units not shipped yet",
    shipRest: "Ship the rest",
    shipPart: "Ship part of the order",
    title: "Ship part of the order",
    intro: "Choose the units that go in this parcel. The rest stays on the order for a later parcel.",
    product: "Product",
    ordered: "Ordered",
    inParcels: "In parcels",
    left: "Left",
    thisParcel: "This parcel",
    less: "One less",
    more: "One more",
    qtyOf: "Units of {name} in this parcel",
    shipsFrom: "Ships from {date}",
    notShipped: "Not shipped",
    codAmount: "Amount the courier collects",
    codHint: "The customer still owes {amount}",
    method: "How is it shipped?",
    manual: "Manual",
    carrierName: "Courier name",
    carrierNameHint: "Optional. Leave empty for your own delivery.",
    waybill: "Tracking no.",
    trackingUrl: "Tracking link",
    notes: "Note for the courier",
    submit: "Book this parcel",
    submitting: "Booking…",
    booked: "Parcel booked.",
    chooseUnits: "Choose at least one unit for this parcel.",
    nothingLeft: "Every unit of this order is already in a parcel",
    unavailable: "These units are already in another parcel",
    codTooMuch: "That's more than the customer still owes ({amount})",
    invalidAmount: "Enter a valid amount.",
    loadFailed: "The order's parcels couldn't be read.",
    retry: "Try again",
    loading: "Loading…",
  },
  ar: {
    parcelOf: "شحنة {n} من {total}",
    collect: "تحصيل {amount}",
    printWaybill: "اطبع البوليصة",
    preparing: "بنجهّز…",
    leftNote_one: "فاضل قطعة واحدة ما اتشحنتش",
    leftNote_two: "فاضل قطعتين ما اتشحنوش",
    leftNote_few: "فاضل {n} قطع ما اتشحنتش",
    leftNote_other: "فاضل {n} قطعة ما اتشحنتش",
    shipRest: "اشحن الباقي",
    shipPart: "شحن جزء من الطلب",
    title: "شحن جزء من الطلب",
    intro: "اختار القطع اللي هتتشحن في الشحنة دي. الباقي يفضل على الطلب لشحنة بعدين.",
    product: "المنتج",
    ordered: "في الطلب",
    inParcels: "اتشحن",
    left: "فاضل",
    thisParcel: "الشحنة دي",
    less: "قطعة أقل",
    more: "قطعة كمان",
    qtyOf: "عدد قطع {name} في الشحنة دي",
    shipsFrom: "بيتشحن من {date}",
    notShipped: "مش بيتشحن",
    codAmount: "المبلغ اللي هيحصّله المندوب",
    codHint: "باقي على العميل {amount}",
    method: "هتتشحن إزاي؟",
    manual: "يدوي",
    carrierName: "اسم شركة الشحن",
    carrierNameHint: "اختياري. سيبه فاضي لو بتوصّل بنفسك.",
    waybill: "رقم التتبع",
    trackingUrl: "رابط التتبع",
    notes: "ملاحظة للمندوب",
    submit: "احجز الشحنة دي",
    submitting: "بنحجز…",
    booked: "اتحجزت الشحنة.",
    chooseUnits: "اختار قطعة واحدة على الأقل للشحنة دي.",
    nothingLeft: "كل قطع الطلب في شحنات بالفعل",
    unavailable: "القطع دي في شحنة تانية بالفعل",
    codTooMuch: "المبلغ أكبر من الباقي على العميل ({amount})",
    invalidAmount: "اكتب مبلغ صحيح.",
    loadFailed: "مقدرناش نقرا شحنات الطلب.",
    retry: "جرّب تاني",
    loading: "بنحمّل…",
  },
} satisfies Messages;

type Strings = Record<keyof typeof STRINGS.en, string>;

const MANUAL = "manual";

function pluralLeft(t: Strings, n: number): string {
  const table = t as unknown as Record<string, string | undefined>;
  const form = n === 1 ? table.leftNote_one : n === 2 ? (table.leftNote_two ?? table.leftNote_other) : n <= 10 ? (table.leftNote_few ?? table.leftNote_other) : table.leftNote_other;
  return fmt(form ?? t.leftNote_other, { n });
}

/** True when the order goes out as several parcels (any of its shipments names its units). */
export function orderIsSplit(order: Order): boolean {
  return (order.shipments ?? []).some((s) => parcelItemsOf(s) !== null);
}

/**
 * Under a shipment's first line when the order has several: «شحنة 1 من 2», the
 * units it carries, what the courier collects for it, and its own waybill to
 * print (handoff 375).
 */
export function ParcelFacts({ order, shipment }: { order: Order; shipment: Shipment }) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [printing, setPrinting] = useState(false);

  const all = order.shipments ?? [];
  const items = parcelItemsOf(shipment);
  if (all.length < 2 && !items) return null;

  // Oldest first, whatever order the server lists them in: parcel 1 is the first one booked.
  const sorted = [...all].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const index = sorted.findIndex((s) => s.id === shipment.id) + 1;
  const cod = parcelCodOf(shipment);
  const nameOf = (orderItemId: string) => order.items.find((i) => i.id === orderItemId)?.productNameSnapshot ?? orderItemId.slice(0, 8);
  const live = !FINISHED_SHIPMENT_STATUSES.has(shipment.status);

  async function print() {
    setPrinting(true);
    try {
      const blob = await parcelWaybillPdf(apiClient, workspaceId, order.id, shipment.id);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener");
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setPrinting(false);
    }
  }

  return (
    <div data-slot="parcel-facts" className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-soft">
      {all.length > 1 && <span className="font-semibold text-ink">{fmt(t.parcelOf, { n: index, total: all.length })}</span>}
      {items && (
        <span>
          {items.map((line, i) => (
            <span key={line.orderItemId}>
              {i > 0 && " · "}
              <span className="tabular-nums">{line.quantity} × </span>
              <bdi>{nameOf(line.orderItemId)}</bdi>
            </span>
          ))}
        </span>
      )}
      {cod !== null && cod > 0 && <span className="font-medium text-ink">{fmt(t.collect, { amount: formatMoney(cod, order.currency) })}</span>}
      {items && live && (
        <button
          type="button"
          disabled={printing}
          onClick={() => void print()}
          className="inline-flex min-h-11 cursor-pointer items-center gap-1 rounded-full px-2 font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-60 pointer-fine:min-h-8"
        >
          <IconPrint className="size-4" aria-hidden />
          {printing ? t.preparing : t.printWaybill}
        </button>
      )}
    </div>
  );
}

/**
 * "Ship part of the order" (handoff 375). Reads the order's parcel plan and
 * offers, beside the usual ship form, a dialog that books a parcel with only
 * some of the units; once the order is split it says how many units are still
 * to send, with "Ship the rest".
 */
export function PartialShipment({
  order,
  carriers,
  canManage,
  onChanged,
}: {
  order: Order;
  /** Every courier the server offers this store; the connected ones can book. */
  carriers: CarrierInfo[];
  canManage: boolean;
  onChanged: () => void;
}) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const [open, setOpen] = useState(false);
  // Read again whenever the order's shipments change.
  const stamp = (order.shipments ?? []).map((s) => `${s.id}:${s.status}`).join(",");
  // One unit and no split parcel: nothing to divide, so nothing to ask the server.
  const units = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const worthAsking = !order.cancelledAt && (units > 1 || orderIsSplit(order));
  const plan = useAsync(
    () => (worthAsking ? parcelPlan(apiClient, workspaceId, order.id) : Promise.resolve(null)),
    [workspaceId, order.id, stamp, order.updatedAt, worthAsking]
  );
  const data = plan.data;

  if (!data || order.cancelledAt) return null;
  const split = data.shipments.some((s) => Array.isArray(s.items) && s.items.length > 0);
  const shippableUnits = data.lines.filter((l) => l.shippable).reduce((sum, l) => sum + l.remaining, 0);
  const canOffer = canManage && data.suggested !== null && shippableUnits > 0;
  // A whole-order parcel still on its way leaves nothing to split.
  const wholeLive = data.shipments.some((s) => !s.items && !FINISHED_SHIPMENT_STATUSES.has(s.status));
  // One unit in all cannot be divided.
  const divisible = split || shippableUnits > 1;

  if (!split && (!canOffer || wholeLive || !divisible)) return null;

  return (
    <div data-slot="parcel-plan" className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-[0.5rem] border border-line px-4 py-3">
      {split && data.unitsRemaining > 0 ? (
        <p className="text-sm font-medium text-ink">{pluralLeft(t, data.unitsRemaining)}</p>
      ) : split ? (
        <p className="text-sm text-ink-soft">{t.nothingLeft}</p>
      ) : (
        <p className="text-sm text-ink-soft">{t.intro}</p>
      )}
      {canOffer && (
        <Button type="button" variant="outline" className="min-h-11" onClick={() => setOpen(true)}>
          {split ? t.shipRest : t.shipPart}
        </Button>
      )}
      {open && (
        <PartialShipmentDialog
          order={order}
          plan={data}
          carriers={carriers}
          onClose={() => setOpen(false)}
          onBooked={() => {
            setOpen(false);
            void plan.refresh({ silent: true });
            onChanged();
          }}
          onStale={() => void plan.refresh({ silent: true })}
        />
      )}
    </div>
  );
}

function optionsText(line: ParcelPlanLine): string {
  return line.variantOptions ? Object.values(line.variantOptions).filter(Boolean).join(" · ") : "";
}

function PartialShipmentDialog({
  order,
  plan,
  carriers,
  onClose,
  onBooked,
  onStale,
}: {
  order: Order;
  plan: ParcelPlan;
  carriers: CarrierInfo[];
  onClose: () => void;
  onBooked: () => void;
  onStale: () => void;
}) {
  const t = useT(STRINGS);
  const common = useCommon();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const carrierError = useCarrierErrorMessage();
  const methodId = useId();
  const isCod = plan.paymentMethod === "cod";
  const codRemaining = Number(plan.codRemaining) || 0;
  const connected = carriers.filter((c) => c.connection);

  const suggested = useMemo(() => new Map((plan.suggested?.items ?? []).map((i) => [i.orderItemId, i.quantity])), [plan]);
  const [qty, setQty] = useState<Record<string, number>>(() =>
    Object.fromEntries(plan.lines.map((l) => [l.orderItemId, Math.min(suggested.get(l.orderItemId) ?? 0, l.remaining)]))
  );
  const [cod, setCod] = useState(() => (plan.suggested?.codAmount != null ? minorToMajorInput(plan.suggested.codAmount) : ""));
  // Left alone, the amount is the server's own share for the units picked; typed, it is sent as typed.
  const [codTouched, setCodTouched] = useState(false);
  const [method, setMethod] = useState<string>(MANUAL);
  const [carrierName, setCarrierName] = useState("");
  const [waybill, setWaybill] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [picker, setPicker] = useState<PickerSource | null>(null);
  const [cityId, setCityId] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const courier = method === MANUAL ? undefined : connected.find((c) => c.code === method);
  const items: ParcelItem[] = plan.lines
    .filter((l) => l.shippable && (qty[l.orderItemId] ?? 0) > 0)
    .map((l) => ({ orderItemId: l.orderItemId, quantity: Math.min(qty[l.orderItemId], l.remaining) }));
  const picksSuggestion =
    items.length === suggested.size && items.every((i) => suggested.get(i.orderItemId) === i.quantity);
  // Every unit still to send, on an order with no parcel yet, is simply the whole order: no amount of its own.
  const everything = plan.lines.filter((l) => l.shippable).every((l) => (qty[l.orderItemId] ?? 0) === l.remaining);
  const wholeOrder = everything && plan.shipments.every((s) => !s.items || FINISHED_SHIPMENT_STATUSES.has(s.status)) && plan.lines.every((l) => l.inShipments === 0);

  useEffect(() => {
    // The suggested amount belongs to the suggested units; another choice lets the server work its share out.
    if (!codTouched) setCod(picksSuggestion && plan.suggested?.codAmount != null ? minorToMajorInput(plan.suggested.codAmount) : "");
  }, [picksSuggestion, codTouched, plan]);

  function step(line: ParcelPlanLine, by: number) {
    setQty((prev) => ({ ...prev, [line.orderItemId]: Math.max(0, Math.min(line.remaining, (prev[line.orderItemId] ?? 0) + by)) }));
    setError(null);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setFieldErrors({});
    if (items.length === 0) {
      setError(t.chooseUnits);
      return;
    }
    let codAmount: number | undefined;
    if (isCod && !wholeOrder && cod.trim() !== "") {
      const minor = majorToMinor(cod);
      if (!Number.isFinite(minor) || minor < 0) {
        setFieldErrors({ codAmount: t.invalidAmount });
        return;
      }
      codAmount = minor;
    }
    setBusy(true);
    try {
      await parcelCreate(apiClient, workspaceId, order.id, {
        carrierCode: courier ? courier.code : carrierName.trim() || MANUAL,
        ...(courier
          ? {
              ...(picker && cityId && districtId ? { carrierAddress: { cityId, districtId } } : {}),
              ...(notes.trim() ? { notes: notes.trim() } : {}),
            }
          : {
              ...(waybill.trim() ? { waybillNumber: waybill.trim() } : {}),
              ...(trackingUrl.trim() ? { trackingUrl: trackingUrl.trim() } : {}),
            }),
        items,
        ...(codAmount !== undefined ? { codAmount } : {}),
      });
      toast.success(t.booked);
      onBooked();
    } catch (err) {
      const code = apiErrorCode(err);
      const maxCod = parcelMaxCodOf(err);
      if (maxCod !== null) {
        setFieldErrors({ codAmount: fmt(t.codTooMuch, { amount: formatMoney(maxCod, order.currency) }) });
      } else if (code === "SHIPMENT_ITEMS_UNAVAILABLE") {
        setError(t.unavailable);
        onStale();
      } else if (code === "SHIPMENT_ALREADY_EXISTS") {
        setError(t.nothingLeft);
        onStale();
      } else if (courier && usesCityDistrict(courier) && isApiErrorCode(err, "CARRIER_ADDRESS_UNMATCHED")) {
        const details = apiErrorDetails<CarrierAddressUnmatchedDetails>(err);
        if (details) {
          setPicker({ kind: "unmatched", details });
          setCityId(details.level === "district" && details.matchedCity ? details.matchedCity.id : "");
          setDistrictId("");
        }
        setError(carrierError(err, courier));
      } else {
        const problems = apiFieldProblems(err);
        const fields: Record<string, string> = {};
        for (const p of problems) fields[p.field.startsWith("items") ? "items" : p.field] = p.message;
        setFieldErrors(fields);
        if (problems.length === 0 || !problems.some((p) => ["codAmount", "waybillNumber", "trackingUrl", "carrierCode", "notes"].includes(p.field))) {
          setError(courier ? carrierError(err, courier) : errorMessage(err));
        }
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
      title={t.title}
      description={t.intro}
      className="sm:max-w-2xl"
      footer={
        <>
          <Button type="button" variant="outline" className="rounded-full px-5" disabled={busy} onClick={onClose}>
            {common.cancel}
          </Button>
          <Button type="submit" form={`${methodId}-form`} className="rounded-full px-5" disabled={busy}>
            {busy ? t.submitting : t.submit}
          </Button>
        </>
      }
    >
      <form id={`${methodId}-form`} onSubmit={submit} noValidate className="space-y-4">
        {error && (
          <Alert variant="danger" role="alert">
            {error}
          </Alert>
        )}

        <ul className="divide-y divide-line rounded-[0.75rem] border border-line">
          {plan.lines.map((line) => {
            const options = optionsText(line);
            const value = qty[line.orderItemId] ?? 0;
            return (
              <li key={line.orderItemId} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-3 py-2.5">
                <div className="min-w-0 flex-1 basis-48">
                  <p className="text-sm font-medium text-ink">
                    <bdi>{line.productName}</bdi>
                  </p>
                  {options && (
                    <p className="text-xs text-ink-soft">
                      <bdi>{options}</bdi>
                    </p>
                  )}
                  <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-ink-soft tabular-nums">
                    <span>
                      {t.ordered}: {line.quantity}
                    </span>
                    <span>
                      {t.inParcels}: {line.inShipments}
                    </span>
                    <span>
                      {t.left}: {line.remaining}
                    </span>
                  </p>
                  {line.preorderShipsAt && <p className="mt-0.5 text-xs font-medium text-accent-dark">{fmt(t.shipsFrom, { date: formatDate(line.preorderShipsAt) })}</p>}
                </div>
                {!line.shippable ? (
                  <span className="text-xs font-medium text-ink-soft">{t.notShipped}</span>
                ) : (
                  <div role="group" aria-label={fmt(t.qtyOf, { name: line.productName })} className="inline-flex h-11 shrink-0 items-center rounded-full bg-paper-raised ring-1 ring-line">
                    <button
                      type="button"
                      aria-label={t.less}
                      disabled={busy || value <= 0}
                      onClick={() => step(line, -1)}
                      className="flex size-11 cursor-pointer items-center justify-center rounded-full text-ink hover:bg-ink/8 focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-default disabled:text-ink-soft/50"
                    >
                      <IconMinus className="size-4" weight="bold" aria-hidden />
                    </button>
                    <output className="min-w-8 text-center text-sm font-semibold text-ink tabular-nums" aria-live="polite">
                      {value}
                    </output>
                    <button
                      type="button"
                      aria-label={t.more}
                      disabled={busy || value >= line.remaining}
                      onClick={() => step(line, 1)}
                      className="flex size-11 cursor-pointer items-center justify-center rounded-full text-ink hover:bg-ink/8 focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-default disabled:text-ink-soft/50"
                    >
                      <IconPlus className="size-4" weight="bold" aria-hidden />
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        {fieldErrors.items && (
          <p role="alert" className="text-xs font-medium text-danger">
            {fieldErrors.items}
          </p>
        )}

        {isCod && !wholeOrder && (
          <MoneyInput
            label={t.codAmount}
            value={cod}
            onChange={(next) => {
              setCodTouched(true);
              setCod(next);
            }}
            currency={order.currency}
            hint={fmt(t.codHint, { amount: formatMoney(codRemaining, order.currency) })}
            error={fieldErrors.codAmount}
            disabled={busy}
          />
        )}

        <Field label={t.method}>
          {({ id }) => (
            <Select
              id={id}
              value={method}
              disabled={busy}
              onChange={(e) => {
                setMethod(e.target.value);
                setPicker(null);
                setCityId("");
                setDistrictId("");
                setError(null);
              }}
              className="h-11"
            >
              {connected.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
              <option value={MANUAL}>{t.manual}</option>
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
                cityError={fieldErrors["carrierAddress.cityId"]}
                districtError={fieldErrors["carrierAddress.districtId"]}
                disabled={busy}
              />
            )}
            <Field label={t.notes} error={fieldErrors.notes}>
              {({ id, ...aria }) => (
                <Input id={id} {...aria} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} dir="auto" className="h-11" disabled={busy} />
              )}
            </Field>
          </>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label={t.carrierName} hint={t.carrierNameHint} error={fieldErrors.carrierCode}>
              {({ id, ...aria }) => (
                <Input id={id} {...aria} value={carrierName} onChange={(e) => setCarrierName(e.target.value)} maxLength={100} className="h-11" disabled={busy} />
              )}
            </Field>
            <Field label={t.waybill} error={fieldErrors.waybillNumber}>
              {({ id, ...aria }) => (
                <Input id={id} {...aria} value={waybill} onChange={(e) => setWaybill(e.target.value)} maxLength={100} dir="ltr" className="h-11" disabled={busy} />
              )}
            </Field>
            <Field label={t.trackingUrl} error={fieldErrors.trackingUrl}>
              {({ id, ...aria }) => (
                <Input id={id} {...aria} type="url" value={trackingUrl} onChange={(e) => setTrackingUrl(e.target.value)} maxLength={500} dir="ltr" className="h-11" disabled={busy} />
              )}
            </Field>
          </div>
        )}
      </form>
    </Modal>
  );
}
