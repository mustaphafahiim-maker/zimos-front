import type { ShopperAddress, ShopperAddressInput } from "@store-builder/api-client";
import { GOVERNORATES } from "./egypt";
import type { Locale } from "./i18n";
import { provinceFor } from "./orderForm";

/**
 * A saved address as the account and the checkout read and write it. The
 * province travels as the order carries it: "<ar> (<en>)" for an Egyptian
 * governorate (lib/orderForm provinceFor), else what the shopper typed. The
 * city is a name. The store's delivery area is not kept with an address: the
 * shopper picks it at checkout, from the areas the store has that day.
 */

/** The governorates a country's address is picked from; none means a typed region. */
export function governoratesOf(country: string): ReadonlyArray<{ code: string; ar: string; en: string }> {
  return country.toUpperCase() === "EG" ? GOVERNORATES : [];
}

/** "القاهرة (Cairo)" → the shopper's half; any other spelling as it is. */
export function provinceLabel(province: string | null | undefined, locale: Locale): string {
  const text = (province ?? "").trim();
  const match = /^(.*?)\s*\((.*)\)$/.exec(text);
  if (!match) return text;
  return locale === "ar" ? match[1] : match[2] || match[1];
}

/** One line: street, area, city, region. */
export function addressSummary(address: Partial<ShopperAddress>, locale: Locale): string {
  const parts = [address.addressLine, address.area, address.city, provinceLabel(address.province, locale)]
    .map((p) => (p ?? "").trim())
    .filter(Boolean);
  return parts.join(locale === "ar" ? "، " : ", ");
}

/**
 * What the form's region field holds for a stored province: the governorate's
 * code in Egypt ("الجيزة (Giza)", "Giza", "giza" → "giza"; "" when none
 * matches), and the stored words themselves anywhere else.
 */
export function governorateCodeOf(province: string | null | undefined, country: string): string {
  const text = (province ?? "").trim();
  if (!text) return "";
  const list = governoratesOf(country);
  if (list.length === 0) return text;
  const lower = text.toLowerCase();
  const match = list.find((g) => g.code.toLowerCase() === lower || text === provinceFor(g.code) || text === g.ar || lower === g.en.toLowerCase());
  return match ? match.code : "";
}

/** What the account saves from a filled address form. */
export function addressInput(opts: {
  country: string;
  governorate: string;
  city: string;
  addressLine: string;
  postalCode?: string;
  label?: string;
  fullName?: string;
  phone?: string;
  isDefault?: boolean;
}): ShopperAddressInput {
  const country = (opts.country || "EG").toUpperCase();
  const province = provinceFor(opts.governorate) ?? (opts.governorate.trim() || null);
  const clean = (v?: string) => (v ?? "").trim() || null;
  return {
    country,
    province,
    city: opts.city.trim(),
    area: null,
    addressLine: opts.addressLine.trim(),
    postalCode: clean(opts.postalCode),
    label: clean(opts.label),
    fullName: clean(opts.fullName),
    phone: clean(opts.phone),
    ...(opts.isDefault !== undefined ? { isDefault: opts.isDefault } : {}),
  };
}
