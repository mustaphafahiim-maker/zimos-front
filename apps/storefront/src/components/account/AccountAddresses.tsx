"use client";

import { useState } from "react";
import {
  SHOPPER_MAX_ADDRESSES,
  shopperAddAddress,
  shopperDeleteAddress,
  shopperUpdateAddress,
  type ShopperAddress,
  type ShopperAddressInput,
} from "@store-builder/api-client";
import { btnGhost, btnPrimary, btnSecondary, card } from "@/components/ui";
import { addressSummary } from "@/lib/shopperAddress";
import { shopperErrorMessage } from "@/lib/shopperSession";
import { useStore } from "@/lib/StoreContext";
import { btnDanger, btnGhostDanger, useAccount } from "./AccountShell";
import { AddressForm } from "./AddressForm";
import { PinIcon } from "./accountIcons";

/**
 * «العناوين»: the shopper's saved addresses (up to 10, exactly one default)
 * — add, edit, make default, delete. The checkout offers them, the default
 * first (CheckoutSavedAddresses).
 */
export function AccountAddresses() {
  const { t, locale } = useStore();
  const a = t.account;
  const { api, me, setAddresses } = useAccount();
  const addresses = [...me.addresses].sort((x, y) => Number(y.isDefault) - Number(x.isDefault));
  // "new", an address id being edited, or nothing.
  const [editing, setEditing] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const full = addresses.length >= SHOPPER_MAX_ADDRESSES;

  async function save(input: ShopperAddressInput, id: string | null): Promise<string | null> {
    try {
      const list = await api.call((client, storeId, token) =>
        id ? shopperUpdateAddress(client, storeId, token, id, input) : shopperAddAddress(client, storeId, token, input)
      );
      setAddresses(list);
      setEditing(null);
      setStatus(a.saved);
      return null;
    } catch (err) {
      return shopperErrorMessage(err, a);
    }
  }

  async function act(id: string, run: () => Promise<ShopperAddress[]>) {
    setBusy(id);
    setFailure(null);
    setStatus(null);
    try {
      setAddresses(await run());
      setConfirming(null);
      setStatus(a.saved);
    } catch (err) {
      setFailure(shopperErrorMessage(err, a));
    } finally {
      setBusy(null);
    }
  }

  const makeDefault = (id: string) =>
    act(id, () => api.call((client, storeId, token) => shopperUpdateAddress(client, storeId, token, id, { isDefault: true })));
  const remove = (id: string) => act(id, () => api.call((client, storeId, token) => shopperDeleteAddress(client, storeId, token, id)));

  if (editing === "new") {
    return (
      <AddressForm
        canBeDefault={addresses.length > 0}
        onSave={(input) => save(input, null)}
        onCancel={() => setEditing(null)}
      />
    );
  }
  const edited = editing ? addresses.find((x) => x.id === editing) : null;
  if (edited) {
    return (
      <AddressForm
        address={edited}
        canBeDefault={!edited.isDefault}
        onSave={(input) => save(input, edited.id)}
        onCancel={() => setEditing(null)}
      />
    );
  }

  return (
    <div>
      <div aria-live="polite" className="mb-4 empty:hidden">
        {failure && <p className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">{failure}</p>}
        {!failure && status && <p className="rounded-xl bg-success-soft px-4 py-3 text-sm text-success">{status}</p>}
      </div>

      {addresses.length === 0 ? (
        <div className={`${card} flex flex-col items-center px-5 py-10 text-center`}>
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft text-primary">
            <PinIcon size={24} />
          </span>
          <p className="mt-4 text-base font-semibold text-ink">{a.addressesEmpty}</p>
          <p className="mt-1 max-w-sm text-sm text-ink-soft">{a.addressesEmptyHint}</p>
          <button type="button" onClick={() => setEditing("new")} className={`${btnPrimary} mt-5`}>
            {a.addAddress}
          </button>
        </div>
      ) : (
        <>
          <ul className="grid gap-3 md:grid-cols-2">
            {addresses.map((address) => (
              <li key={address.id} className={`${card} flex flex-col p-4 sm:p-5 ${address.isDefault ? "border-primary" : ""}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <PinIcon size={18} className="shrink-0 text-ink-soft" />
                  <p className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
                    {address.label || address.fullName || address.city}
                  </p>
                  {address.isDefault && (
                    <span className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary">{a.default}</span>
                  )}
                </div>
                {address.fullName && address.label && <p className="mt-2 text-sm text-ink">{address.fullName}</p>}
                <p className="mt-1 text-sm text-ink-soft">{addressSummary(address, locale)}</p>
                {address.phone && (
                  <p className="mt-1 text-sm text-ink-soft">
                    <bdi dir="ltr">{address.phone}</bdi>
                  </p>
                )}

                {confirming === address.id ? (
                  <div className="mt-4 rounded-xl bg-danger-soft p-3">
                    <p className="text-sm font-medium text-danger">{a.removeConfirm}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busy === address.id}
                        onClick={() => void remove(address.id)}
                        className={btnDanger}
                      >
                        {a.removeYes}
                      </button>
                      <button type="button" onClick={() => setConfirming(null)} className={btnGhost}>
                        {a.cancel}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-auto flex flex-wrap gap-2 pt-4">
                    <button type="button" onClick={() => setEditing(address.id)} className={btnSecondary}>
                      {a.edit}
                    </button>
                    {!address.isDefault && (
                      <button
                        type="button"
                        disabled={busy === address.id}
                        onClick={() => void makeDefault(address.id)}
                        className={btnSecondary}
                      >
                        {a.makeDefault}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setConfirming(address.id)}
                      className={btnGhostDanger}
                    >
                      {a.remove}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
          <div className="mt-5">
            <button
              type="button"
              disabled={full}
              onClick={() => {
                setStatus(null);
                setFailure(null);
                setEditing("new");
              }}
              className={`${btnPrimary} w-full sm:w-auto`}
            >
              {a.addAddress}
            </button>
            {full && <p className="mt-2 text-sm text-ink-soft">{a.maxAddresses(SHOPPER_MAX_ADDRESSES)}</p>}
          </div>
        </>
      )}
    </div>
  );
}
