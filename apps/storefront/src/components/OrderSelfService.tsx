"use client";

import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react";
import {
  ApiError,
  apiErrorCode,
  apiFieldProblems,
  ORDER_SELF_SERVICE_NOTES_MAX,
  ORDER_SELF_SERVICE_REASON_MAX,
  orderSelfServiceCancel,
  orderSelfServiceChangeAddress,
  orderSelfServiceGet,
  type OrderSelfServiceAddress,
  type OrderSelfServiceRef,
  type OrderSelfServiceState,
  type ShopperAddress,
  type ShopperAddressInput,
} from "@store-builder/api-client";
import { createStorefrontApiClient } from "@/lib/apiClient";
import { pickText } from "@/lib/i18n";
import { useStore } from "@/lib/StoreContext";
import { AddressForm } from "./account/AddressForm";
import { btnGhost, btnPrimary, btnSecondary, input, label as labelClass } from "./ui";

const TEXT = {
  en: {
    title: "Change this order",
    cancel: "Cancel order",
    changeAddress: "Change address",
    until: (time: string) => `Available until ${time}`,
    cancelTitle: "Cancel this order?",
    cancelBody: "The store stops preparing it. This can't be undone.",
    reason: "Reason",
    reasonPlaceholder: "Ordered by mistake, don't need it any more…",
    confirmCancel: "Yes, cancel the order",
    keep: "Keep the order",
    cancelling: "Cancelling…",
    cancelled: "Your order is cancelled.",
    cancelNotAllowed: "This order can no longer be cancelled here — contact the store",
    addressTitle: "Change the delivery address",
    addressHint: "Write the new address in full.",
    notes: "Notes for the courier",
    addressChanged: "The delivery address is updated.",
    shippingNote: "The shipping price stays as it is — the store will confirm any difference with you.",
    addressNotAllowed: "The address can no longer be changed here — contact the store",
    rateLimited: "Too many tries. Wait a little and try again.",
    notFound: "We couldn't find this order.",
    failed: "That didn't go through. Try again.",
  },
  ar: {
    title: "تعديل الطلب",
    cancel: "إلغاء الطلب",
    changeAddress: "تغيير العنوان",
    until: (time: string) => `متاح لحد ${time}`,
    cancelTitle: "تلغي الطلب ده؟",
    cancelBody: "المتجر هيوقّف تجهيزه. مينفعش ترجع في الإلغاء.",
    reason: "السبب",
    reasonPlaceholder: "طلبته بالغلط، مبقتش محتاجه…",
    confirmCancel: "أيوه، الغي الطلب",
    keep: "خلّي الطلب",
    cancelling: "بنلغي…",
    cancelled: "طلبك اتلغى.",
    cancelNotAllowed: "مينفعش تلغي الطلب من هنا دلوقتي — كلّم المتجر",
    addressTitle: "غيّر عنوان التوصيل",
    addressHint: "اكتب العنوان الجديد كامل.",
    notes: "ملاحظات للمندوب",
    addressChanged: "عنوان التوصيل اتغيّر.",
    shippingNote: "سعر الشحن زي ما هو — المتجر هيأكد معاك لو فيه فرق.",
    addressNotAllowed: "مينفعش تغيّر العنوان من هنا دلوقتي — كلّم المتجر",
    rateLimited: "محاولات كتير. استنى شوية وجرّب تاني.",
    notFound: "مش لاقيين الطلب ده.",
    failed: "محصلش. جرّب تاني.",
  },
  fr: {
    title: "Modifier cette commande",
    cancel: "Annuler la commande",
    changeAddress: "Changer l'adresse",
    until: (time: string) => `Possible jusqu'à ${time}`,
    cancelTitle: "Annuler cette commande ?",
    cancelBody: "La boutique arrête sa préparation. C'est définitif.",
    reason: "Raison",
    reasonPlaceholder: "Commandé par erreur, je n'en ai plus besoin…",
    confirmCancel: "Oui, annuler la commande",
    keep: "Garder la commande",
    cancelling: "Annulation…",
    cancelled: "Votre commande est annulée.",
    cancelNotAllowed: "Cette commande ne peut plus être annulée ici — contactez la boutique",
    addressTitle: "Changer l'adresse de livraison",
    addressHint: "Saisissez la nouvelle adresse en entier.",
    notes: "Notes pour le livreur",
    addressChanged: "L'adresse de livraison est mise à jour.",
    shippingNote: "Les frais de livraison restent les mêmes — la boutique vous confirmera toute différence.",
    addressNotAllowed: "L'adresse ne peut plus être modifiée ici — contactez la boutique",
    rateLimited: "Trop de tentatives. Patientez un peu puis réessayez.",
    notFound: "Commande introuvable.",
    failed: "Cela n'a pas marché. Réessayez.",
  },
};

// The store's button recipes in the danger colour, as the account pages make theirs.
const btnDanger = btnPrimary.replace("bg-primary ", "bg-danger ").replace("hover:bg-primary/90", "hover:bg-danger/90");
const btnDangerOutline = btnSecondary.replace(" text-ink ", " text-danger ").replace("hover:border-primary hover:text-primary", "hover:border-danger");

/** The order's address as the tracking and account pages hold it, with the courier note the snapshot carries. */
type OrderAddress = Partial<ShopperAddress> & { notes?: string | null };

export type OrderSelfServiceProps = (
  | { token: string; orderId?: undefined; shopperToken?: undefined }
  | { orderId: string; shopperToken: string; token?: undefined }
) & {
  /** The store's workspace id; defaults to the store this page belongs to. */
  workspaceId?: string;
  /** The order's current delivery address, when the page has it: the address form opens on it. */
  address?: OrderAddress | null;
  /** The order was cancelled, or has a new address: the page reads it again. */
  onChanged?: (change: "cancelled" | "address") => void;
  /** Classes for the section (default: a top margin and a hairline, as on the tracking card). */
  className?: string;
};

const same = (a: string | null | undefined, b: string | null | undefined) => (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();

/**
 * What the shopper may still do on an order themselves (handoff 220, 287):
 * "Cancel order" (an optional reason, then a confirmation) and "Change
 * address" (the account's address form, with the courier note), each shown
 * only while the store allows it, with the time it stays possible. Nothing at
 * all when neither is allowed.
 *
 * The order is named by the tracking link's token (`token`) or, for a
 * signed-in shopper, by `orderId` + `shopperToken` (X-Shopper-Token).
 */
export function OrderSelfService(props: OrderSelfServiceProps) {
  const { t: dictionary, locale, intlLocale, store } = useStore();
  const t = pickText(TEXT, locale);
  const uid = useId();
  const workspaceId = props.workspaceId ?? store?.workspaceId ?? "";
  const orderRef: OrderSelfServiceRef | null = props.token
    ? { token: props.token }
    : props.orderId && props.shopperToken
      ? { orderId: props.orderId, shopperToken: props.shopperToken }
      : null;
  const refKey = orderRef ? ("token" in orderRef ? orderRef.token : `${orderRef.orderId}:${orderRef.shopperToken}`) : "";

  const [client] = useState(() => createStorefrontApiClient());
  const [state, setState] = useState<OrderSelfServiceState | null>(null);
  const [open, setOpen] = useState<"cancel" | "address" | null>(null);
  const [done, setDone] = useState<"cancelled" | "address" | null>(null);
  /** The store said no on submit (too late, already confirmed or shipped): shown until the page changes order. */
  const [refusal, setRefusal] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const call = useRef(0);
  const doneRef = useRef<HTMLParagraphElement>(null);
  const cancelHeading = useRef<HTMLHeadingElement>(null);
  const addressBox = useRef<HTMLDivElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const addressButton = useRef<HTMLButtonElement>(null);

  const load = useCallback(async () => {
    if (!orderRef || !workspaceId) return;
    const id = ++call.current;
    try {
      const next = await orderSelfServiceGet(client, workspaceId, orderRef);
      if (id === call.current) setState(next);
    } catch {
      // Not this shopper's order, or the store could not be asked: no buttons, the page around says the rest.
      if (id === call.current) setState(null);
    }
    // refKey stands for orderRef: a new object with the same order is not a change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, workspaceId, refKey]);

  useEffect(() => {
    setOpen(null);
    setDone(null);
    setRefusal(null);
    void load();
  }, [load]);

  useEffect(() => {
    if (done) doneRef.current?.focus();
  }, [done]);

  useEffect(() => {
    if (open === "cancel") cancelHeading.current?.focus();
    if (open === "address") addressBox.current?.querySelector<HTMLElement>("select, input, textarea")?.focus();
  }, [open]);

  if (!orderRef || !workspaceId) return null;
  const canCancel = Boolean(state?.canCancel) && done !== "cancelled";
  const canChange = Boolean(state?.canChangeAddress) && done !== "cancelled";
  if (!canCancel && !canChange && !done && !refusal) return null;

  const current = props.address ?? null;
  const hasCurrent = Boolean(current && (current.addressLine || current.city || current.province));

  /** "3:15 PM" today, "9 October, 3:15 PM" for another day. */
  const when = (iso: string) => {
    const date = new Date(iso);
    const today = date.toDateString() === new Date().toDateString();
    return new Intl.DateTimeFormat(
      intlLocale,
      today ? { hour: "numeric", minute: "2-digit" } : { day: "numeric", month: "long", hour: "numeric", minute: "2-digit" }
    ).format(date);
  };

  function start(what: "cancel" | "address") {
    setError(null);
    setRefusal(null);
    setDone(null);
    if (what === "address") setNotes(current?.notes ?? "");
    setOpen(what);
  }

  function close() {
    const back = open === "cancel" ? cancelButton : addressButton;
    setOpen(null);
    setError(null);
    requestAnimationFrame(() => back.current?.focus());
  }

  /** A failed call in the shopper's words; null when the store refused the action itself (said above the buttons). */
  function explain(err: unknown, what: "cancel" | "address"): string | null {
    const code = apiErrorCode(err);
    if (code === "CANCEL_NOT_ALLOWED" || code === "ADDRESS_CHANGE_NOT_ALLOWED") {
      setOpen(null);
      setRefusal(what === "cancel" ? t.cancelNotAllowed : t.addressNotAllowed);
      void load();
      return null;
    }
    if (code === "SHIPPING_PLACE_UNAVAILABLE") return dictionary.form.errors.placeUnavailable;
    const fields = apiFieldProblems(err).map((p) => p.field);
    if (fields.some((f) => f.endsWith("placeId"))) return dictionary.form.errors.placeUnknown;
    if (fields.some((f) => f.endsWith("province"))) return dictionary.form.errors.governorate;
    if (fields.some((f) => f.endsWith("city"))) return dictionary.form.errors.city;
    if (fields.some((f) => f.endsWith("addressLine"))) return dictionary.form.errors.address;
    if (err instanceof ApiError && err.status === 429) return t.rateLimited;
    if (err instanceof ApiError && err.status === 404) return t.notFound;
    return t.failed;
  }

  async function submitCancel(e: FormEvent) {
    e.preventDefault();
    if (busy || !orderRef) return;
    setBusy(true);
    setError(null);
    try {
      await orderSelfServiceCancel(client, workspaceId, orderRef, reason);
      setOpen(null);
      setDone("cancelled");
      props.onChanged?.("cancelled");
      void load();
    } catch (err) {
      setError(explain(err, "cancel"));
    } finally {
      setBusy(false);
    }
  }

  /** The address form's save: the problem to show in the form, or null once the order has the new address. */
  async function saveAddress(form: ShopperAddressInput): Promise<string | null> {
    if (!orderRef) return t.failed;
    const province = (form.province ?? "").trim();
    // Every field is sent (handoff 287: what is left out is cleared). What the form has no field
    // for stays with the same city: the area and place when the store keeps no list of its own,
    // the postal code when the store's form hides it.
    const sameCity = Boolean(current && !form.placeId && same(current.city, form.city) && same(current.province, province));
    const postalHidden = store?.checkout?.postal_code === "hidden";
    const address: OrderSelfServiceAddress = {
      country: form.country,
      province,
      city: form.city,
      area: form.area ?? (sameCity ? (current?.area ?? null) : null),
      placeId: form.placeId ?? (sameCity ? (current?.placeId ?? null) : null),
      addressLine: form.addressLine,
      postalCode: form.postalCode ?? (postalHidden ? (current?.postalCode ?? null) : null),
      notes: notes.trim().slice(0, ORDER_SELF_SERVICE_NOTES_MAX) || null,
    };
    try {
      await orderSelfServiceChangeAddress(client, workspaceId, orderRef, address);
      setOpen(null);
      setDone("address");
      props.onChanged?.("address");
      void load();
      return null;
    } catch (err) {
      return explain(err, "address");
    }
  }

  const titleId = `${uid}-title`;
  const reasonId = `${uid}-reason`;
  const notesId = `${uid}-notes`;
  const optional = <span className="ms-1 text-xs font-normal text-ink-soft">({dictionary.common.optional})</span>;

  return (
    <section className={props.className ?? "mt-6 border-t border-line pt-5"} aria-labelledby={titleId}>
      <h3 id={titleId} className="text-sm font-semibold text-ink">
        {t.title}
      </h3>

      {done && (
        <p ref={doneRef} tabIndex={-1} role="status" className="mt-3 rounded-xl bg-success-soft px-4 py-3 text-sm font-semibold text-success outline-none">
          {done === "cancelled" ? t.cancelled : t.addressChanged}
          {done === "address" && <span className="mt-1 block font-normal">{t.shippingNote}</span>}
        </p>
      )}

      {refusal && (
        <p role="alert" className="mt-3 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">
          {refusal}
        </p>
      )}

      {!open && (canChange || canCancel) && (
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start">
          {canChange && (
            <div className="space-y-1.5">
              <button ref={addressButton} type="button" onClick={() => start("address")} className={`${btnSecondary} w-full sm:w-auto`}>
                {t.changeAddress}
              </button>
              {state?.addressUntil && <p className="text-xs text-ink-soft">{t.until(when(state.addressUntil))}</p>}
            </div>
          )}
          {canCancel && (
            <div className="space-y-1.5">
              <button ref={cancelButton} type="button" onClick={() => start("cancel")} className={`${btnDangerOutline} w-full sm:w-auto`}>
                {t.cancel}
              </button>
              {state?.cancelUntil && <p className="text-xs text-ink-soft">{t.until(when(state.cancelUntil))}</p>}
            </div>
          )}
        </div>
      )}

      {open === "cancel" && (
        <form
          onSubmit={submitCancel}
          noValidate
          className="mt-4 space-y-4 rounded-xl border border-line bg-paper p-4"
          aria-labelledby={`${uid}-cancel-title`}
        >
          <div>
            <h4 id={`${uid}-cancel-title`} ref={cancelHeading} tabIndex={-1} className="text-base font-semibold text-ink outline-none">
              {t.cancelTitle}
            </h4>
            <p className="mt-0.5 text-sm text-ink-soft">{t.cancelBody}</p>
          </div>
          <div>
            <label htmlFor={reasonId} className={labelClass}>
              {t.reason}
              {optional}
            </label>
            <textarea
              id={reasonId}
              value={reason}
              maxLength={ORDER_SELF_SERVICE_REASON_MAX}
              rows={3}
              dir="auto"
              disabled={busy}
              placeholder={t.reasonPlaceholder}
              onChange={(e) => setReason(e.target.value)}
              className={`${input} min-h-24 resize-y`}
            />
          </div>
          {error && (
            <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">
              {error}
            </p>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={close} disabled={busy} className={btnGhost}>
              {t.keep}
            </button>
            <button type="submit" disabled={busy} aria-busy={busy} className={btnDanger}>
              {busy ? t.cancelling : t.confirmCancel}
            </button>
          </div>
        </form>
      )}

      {open === "address" && (
        <div ref={addressBox} className="mt-4 space-y-2">
          {!hasCurrent && <p className="text-sm text-ink-soft">{t.addressHint}</p>}
          <AddressForm
            addressOnly
            title={t.addressTitle}
            canBeDefault={false}
            address={
              hasCurrent && current
                ? {
                    id: "order",
                    isDefault: false,
                    country: current.country ?? "",
                    province: current.province ?? null,
                    city: current.city ?? "",
                    area: current.area ?? null,
                    addressLine: current.addressLine ?? "",
                    postalCode: current.postalCode ?? null,
                    placeId: current.placeId ?? null,
                  }
                : null
            }
            onSave={saveAddress}
            onCancel={close}
          >
            <div className="sm:col-span-2">
              <label htmlFor={notesId} className={labelClass}>
                {t.notes}
                {optional}
              </label>
              <textarea
                id={notesId}
                value={notes}
                maxLength={ORDER_SELF_SERVICE_NOTES_MAX}
                rows={2}
                dir="auto"
                onChange={(e) => setNotes(e.target.value)}
                className={`${input} min-h-20 resize-y`}
              />
            </div>
          </AddressForm>
        </div>
      )}
    </section>
  );
}
