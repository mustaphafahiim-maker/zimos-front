"use client";

import { useEffect, useRef, useState } from "react";
import {
  SHOPPER_MAX_ADDRESSES,
  shopperAddAddress,
  shopperMe,
  type ShopperAddress,
  type ShopperMe,
} from "@store-builder/api-client";
import { StoreLink } from "@/components/StoreRoute";
import { btnSecondary, focusRing } from "@/components/ui";
import { normalizePhone } from "@/lib/egypt";
import type { OrderFormField, OrderFormValues } from "@/lib/orderForm";
import { addressInput, addressSummary, governorateCodeOf, usePlaceSteps } from "@/lib/shopperAddress";
import { isShopperSignedOutError, shopperErrorMessage, useShopperApi, useShopperConfig } from "@/lib/shopperSession";
import { useStore } from "@/lib/StoreContext";
import { useStoreCountry } from "@/lib/storeCountry";
import type { StorePlacesState } from "@/lib/useStorePlaces";
import { PinIcon, UserIcon } from "./accountIcons";

const same = (a: string | null | undefined, b: string | null | undefined) =>
  (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();

/**
 * The checkout for a signed-in shopper (frontend-handoff 185), dropped into
 * the checkout's shipping card above the form: the contact comes from GET
 * /me (only into empty fields), the saved addresses are offered with the
 * default picked, and picking one fills the address — the region → city →
 * area pickers and the place id included (lib/shopperAddress usePlaceSteps).
 * A typed address can be kept with «احفظ العنوان ده». Signed out, on a store
 * with accounts, it is one line linking to the sign-in, which comes back
 * here. On a store without accounts it renders nothing.
 *
 * Everything goes through the form's own `onChange`, so validation, the
 * shipping quote and the order payload read the fields as they always do.
 */
export function CheckoutSavedAddresses({
  values,
  onChange,
  places,
}: {
  values: OrderFormValues;
  onChange: (field: OrderFormField, value: string) => void;
  places: StorePlacesState;
}) {
  const { t, locale } = useStore();
  const a = t.account;
  const config = useShopperConfig();
  const api = useShopperApi();
  const storeCountry = useStoreCountry();
  const pickPlace = usePlaceSteps(places);
  // value null: /me failed — the plain form then, nothing in the way of the order.
  const [me, setMe] = useState<{ token: string; value: ShopperMe | null } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  // The form as it is when /me answers, for the one-time prefill.
  const valuesRef = useRef(values);
  useEffect(() => {
    valuesRef.current = values;
  });

  const enabled = config.status === "ready" && config.config.enabled;
  const token = api.token;
  const current = me && me.token === token ? me.value : null;

  function apply(address: ShopperAddress) {
    const set = onChange;
    // A new pick starts from no place; a saved place is then picked level by level.
    if (places.active && places.regionId) places.pickRegion("");
    if (address.fullName) set("fullName", address.fullName);
    if (address.phone) set("phone", normalizePhone(address.phone));
    set("governorate", governorateCodeOf(address.province, address.country || storeCountry));
    set("city", address.city ?? "");
    set("address", address.addressLine ?? "");
    set("postalCode", address.postalCode ?? "");
    pickPlace(address.placeId);
    setSelected(address.id);
    setNote(null);
  }

  // The shopper and their addresses, once per token; then the contact and the default address.
  useEffect(() => {
    if (!enabled || !token || (me && me.token === token)) return;
    let cancelled = false;
    api
      .call((client, storeId, tk) => shopperMe(client, storeId, tk))
      .then((value) => {
        if (cancelled) return;
        setMe({ token, value });
        const set = onChange;
        const now = valuesRef.current;
        const { customer, addresses } = value;
        if (!now.fullName.trim() && customer.fullName) set("fullName", customer.fullName);
        if (!now.phone.trim() && customer.phone) set("phone", normalizePhone(customer.phone));
        if (!now.email.trim() && customer.email) set("email", customer.email);
        // A form already holding an address (a recovery link, a return from sign-in) is left as it is.
        const chosen = addresses.find((x) => x.isDefault) ?? addresses[0];
        if (chosen && !now.address.trim()) apply(chosen);
      })
      .catch((err) => {
        // Signed out: the token is gone and the sign-in line shows. Anything else: the plain form.
        if (!cancelled && !isShopperSignedOutError(err)) setMe({ token, value: null });
      });
    return () => {
      cancelled = true;
    };
    // `me` is read only to skip a reload of the same token; the form's handlers write through functional updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, token, api]);

  if (!enabled) return null;

  if (!token) {
    return (
      <p className="mb-5 flex flex-wrap items-center gap-x-2 rounded-xl bg-primary-soft px-4 py-2 text-sm text-ink">
        <UserIcon size={18} className="shrink-0 text-primary" />
        <span>{a.haveAccount}</span>
        <StoreLink href="/account?next=/checkout" className={`inline-flex min-h-11 items-center font-semibold text-primary underline-offset-4 hover:underline ${focusRing}`}>
          {a.signInToFill}
        </StoreLink>
      </p>
    );
  }
  if (!current) return null;

  const addresses = [...current.addresses].sort((x, y) => Number(y.isDefault) - Number(x.isDefault));
  // A picked address the shopper has since retyped no longer counts as picked.
  const picked = addresses.find((x) => x.id === selected && same(x.addressLine, values.address) && same(x.city, values.city));
  const typed = values.address.trim().length >= 5 && Boolean(values.city.trim() || places.address?.city);
  const canSave = !picked && typed && addresses.length < SHOPPER_MAX_ADDRESSES;

  function other() {
    const set = onChange;
    if (places.active && places.regionId) places.pickRegion("");
    else set("governorate", "");
    set("city", "");
    set("address", "");
    set("postalCode", "");
    setSelected(null);
    setNote(null);
    window.setTimeout(() => document.getElementById("checkout-governorate")?.focus(), 0);
  }

  async function save() {
    setBusy(true);
    setNote(null);
    try {
      const list = await api.call((client, storeId, tk) =>
        shopperAddAddress(
          client,
          storeId,
          tk,
          addressInput({
            country: values.country || storeCountry,
            governorate: values.governorate,
            city: values.city,
            addressLine: values.address,
            postalCode: values.postalCode,
            place: places.active ? places.address : null,
            fullName: values.fullName,
            phone: values.phone ? normalizePhone(values.phone) : "",
          })
        )
      );
      setMe((prev) => (prev?.value ? { ...prev, value: { ...prev.value, addresses: list } } : prev));
      setSelected(list[list.length - 1]?.id ?? null);
      setNote({ tone: "ok", text: a.addressSaved });
    } catch (err) {
      setNote({ tone: "error", text: shopperErrorMessage(err, a) });
    } finally {
      setBusy(false);
    }
  }

  const option = (key: string, checked: boolean, onPick: () => void, title: string, body?: string, badge?: string) => (
    <label
      key={key}
      className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border-2 px-3 py-2.5 transition-colors ${
        checked ? "border-primary bg-primary-soft" : "border-line bg-paper-raised hover:border-primary"
      }`}
    >
      <input
        type="radio"
        name="checkout-saved-address"
        checked={checked}
        onChange={onPick}
        className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-[var(--color-primary)]"
      />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
          {title}
          {badge && <span className="rounded-full bg-paper-raised px-2 py-0.5 text-xs font-medium text-primary">{badge}</span>}
        </span>
        {body && <span className="mt-0.5 block text-xs text-ink-soft">{body}</span>}
      </span>
    </label>
  );

  return (
    <div className="mb-5">
      {addresses.length > 0 && (
        <div role="radiogroup" aria-labelledby="checkout-saved-title">
          <p id="checkout-saved-title" className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
            <PinIcon size={18} className="text-ink-soft" />
            {a.savedAddresses}
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {addresses.map((address) =>
              option(
                address.id,
                picked?.id === address.id,
                () => apply(address),
                address.label || address.fullName || address.city,
                addressSummary(address, locale),
                address.isDefault ? a.default : undefined
              )
            )}
            {option("other", !picked, other, a.otherAddress)}
          </div>
        </div>
      )}
      {canSave && (
        <button type="button" onClick={() => void save()} disabled={busy} className={`${btnSecondary} mt-3 w-full sm:w-auto`}>
          <PinIcon size={18} />
          {busy ? a.saving : a.saveThisAddress}
        </button>
      )}
      <div aria-live="polite" className="empty:hidden">
        {note && (
          <p className={`mt-3 rounded-xl px-4 py-2.5 text-sm ${note.tone === "ok" ? "bg-success-soft text-success" : "bg-danger-soft text-danger"}`}>
            {note.text}
          </p>
        )}
      </div>
    </div>
  );
}
