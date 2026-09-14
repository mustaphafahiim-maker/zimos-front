/**
 * Pure helpers for manual order creation, bulk export and order duplication.
 * Kept free of React so they can be unit-tested.
 */
import type { CreateOrderPayload, Order, PaymentMethod } from "@store-builder/api-client";
import { GOVERNORATES, regionLabel } from "@/pages/onboarding/data";

/** Egyptian mobile: 010 / 011 / 012 / 015 + 8 digits. */
export const EG_PHONE = /^01[0125]\d{8}$/;

/** Strip spaces/dashes and fold +20 / 0020 / Arabic-Indic digits to a local 01xxxxxxxxx. */
export function normalizeEgPhone(input: string): string {
  const ascii = input.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
  let digits = ascii.replace(/[^\d+]/g, "");
  if (digits.startsWith("+20")) digits = "0" + digits.slice(3);
  else if (digits.startsWith("0020")) digits = "0" + digits.slice(4);
  else if (digits.startsWith("20") && digits.length === 12) digits = "0" + digits.slice(2);
  return digits.replace(/\+/g, "");
}

export function isValidEgPhone(input: string): boolean {
  return EG_PHONE.test(normalizeEgPhone(input));
}

/** "01012345678" -> "https://wa.me/201012345678" (null when not a valid EG mobile). */
export function whatsappUrl(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const local = normalizeEgPhone(phone);
  if (!EG_PHONE.test(local)) return null;
  return `https://wa.me/20${local.slice(1)}`;
}

export interface DraftLine {
  key: string;
  productId: string;
  variantId: string;
  offerId: string;
  quantity: number;
}

export interface OrderDraft {
  customerId: string | null;
  phone: string;
  fullName: string;
  governorate: string; // GOVERNORATES code
  city: string;
  addressLine: string;
  notes: string;
  lines: DraftLine[];
  discountCode: string;
  paymentMethod: PaymentMethod;
}

export function emptyDraft(): OrderDraft {
  return {
    customerId: null,
    phone: "",
    fullName: "",
    governorate: "",
    city: "",
    addressLine: "",
    notes: "",
    lines: [],
    discountCode: "",
    paymentMethod: "cod",
  };
}

export type DraftErrors = Partial<Record<string, string>>;

export interface DraftMessages {
  phoneRequired: string;
  phoneInvalid: string;
  nameRequired: string;
  governorateRequired: string;
  cityRequired: string;
  addressRequired: string;
  itemsRequired: string;
  lineVariantRequired: string;
  lineQuantityInvalid: string;
}

/** Client-side validation; keys match the API's Joi paths so server errors land on the same fields. */
export function validateDraft(d: OrderDraft, m: DraftMessages): DraftErrors {
  const e: DraftErrors = {};
  if (!d.phone.trim()) e["contact.phone"] = m.phoneRequired;
  else if (!isValidEgPhone(d.phone)) e["contact.phone"] = m.phoneInvalid;
  if (!d.fullName.trim()) e["contact.fullName"] = m.nameRequired;
  if (!d.governorate) e["shippingAddress.province"] = m.governorateRequired;
  if (!d.city.trim()) e["shippingAddress.city"] = m.cityRequired;
  if (!d.addressLine.trim()) e["shippingAddress.addressLine"] = m.addressRequired;
  if (d.lines.length === 0) e.items = m.itemsRequired;
  d.lines.forEach((l, i) => {
    if (!l.variantId) e[`items.${i}.variantId`] = m.lineVariantRequired;
    if (!Number.isInteger(l.quantity) || l.quantity < 1) e[`items.${i}.quantity`] = m.lineQuantityInvalid;
  });
  return e;
}

/** Exactly what the form POSTs to /workspaces/:id/orders. */
export function buildCreateOrderPayload(d: OrderDraft): CreateOrderPayload {
  const payload: CreateOrderPayload = {
    items: d.lines.map((l) => ({
      variantId: l.variantId,
      ...(l.offerId ? { offerId: l.offerId } : {}),
      quantity: l.quantity,
    })),
    contact: { fullName: d.fullName.trim(), phone: normalizeEgPhone(d.phone) },
    shippingAddress: {
      country: "EG",
      // Same "<ar> (<en>)" format the storefront sends, so shipping zones match.
      province: regionLabel(d.governorate),
      city: d.city.trim(),
      addressLine: d.addressLine.trim(),
    },
    paymentMethod: d.paymentMethod,
  };
  if (d.discountCode.trim()) payload.discountCode = d.discountCode.trim();
  if (d.notes.trim()) payload.notes = d.notes.trim();
  return payload;
}

/** Reverse of regionLabel(): "القاهرة (Cairo)" / "Cairo" -> "cairo". */
export function governorateCodeFromProvince(province: string | null | undefined): string {
  if (!province) return "";
  const p = province.trim().toLowerCase();
  const g = GOVERNORATES.find(
    (x) => regionLabel(x.code).toLowerCase() === p || x.en.toLowerCase() === p || x.ar === province.trim() || x.code === p
  );
  return g ? g.code : "";
}

let lineSeq = 0;
export function newLineKey(): string {
  lineSeq += 1;
  return `l${Date.now().toString(36)}${lineSeq}`;
}

/** Prefill a new draft from an existing order ("Duplicate order"). */
export function draftFromOrder(order: Order): OrderDraft {
  const addr = order.shippingAddressSnapshot ?? {};
  return {
    ...emptyDraft(),
    customerId: order.customerId ?? null,
    phone: order.contactSnapshot?.phone ?? "",
    fullName: order.contactSnapshot?.fullName ?? "",
    governorate: governorateCodeFromProvince(addr.province),
    city: addr.city ?? "",
    addressLine: addr.addressLine ?? "",
    notes: order.notes ?? "",
    paymentMethod: order.paymentMethod ?? "cod",
    lines: (order.items ?? [])
      .filter((i) => i.variantId)
      .map((i) => ({
        key: newLineKey(),
        productId: i.productId ?? "",
        variantId: i.variantId as string,
        offerId: i.offerId ?? "",
        quantity: i.quantity,
      })),
  };
}

export const DRAFT_STORAGE_KEY = "zimos.orders.newDraft";

export function loadDraft(storage: Pick<Storage, "getItem"> | undefined = safeSession()): OrderDraft | null {
  try {
    const raw = storage?.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<OrderDraft>;
    return { ...emptyDraft(), ...parsed, lines: Array.isArray(parsed.lines) ? parsed.lines : [] };
  } catch {
    return null;
  }
}

export function saveDraft(d: OrderDraft, storage: Pick<Storage, "setItem"> | undefined = safeSession()) {
  try {
    storage?.setItem(DRAFT_STORAGE_KEY, JSON.stringify(d));
  } catch {
    /* quota / private mode */
  }
}

export function clearDraft(storage: Pick<Storage, "removeItem"> | undefined = safeSession()) {
  try {
    storage?.removeItem(DRAFT_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

function safeSession(): Storage | undefined {
  try {
    return typeof sessionStorage === "undefined" ? undefined : sessionStorage;
  } catch {
    return undefined;
  }
}

// --- CSV ------------------------------------------------------------------

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV with a UTF-8 BOM so Excel opens Arabic text correctly. */
export function toCsv(rows: unknown[][]): string {
  return "﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
}

export function ordersToCsvRows(orders: Order[], headers: string[]): unknown[][] {
  return [
    headers,
    ...orders.map((o) => [
      o.orderNumber,
      o.createdAt,
      o.contactSnapshot?.fullName ?? "",
      o.contactSnapshot?.phone ?? "",
      o.shippingAddressSnapshot?.province ?? "",
      o.shippingAddressSnapshot?.city ?? "",
      o.shippingAddressSnapshot?.addressLine ?? "",
      (o.items ?? []).map((i) => `${i.productNameSnapshot} x${i.quantity}`).join(" | "),
      (Number(o.totalAmount) / 100).toFixed(2),
      o.currency,
      o.paymentMethod,
      o.confirmationState,
      o.financialState,
      o.fulfillmentState,
      o.cancelledAt ? "yes" : "",
    ]),
  ];
}

/** Client-side text + date-range filter over loaded rows. `from`/`to` are yyyy-mm-dd (local). */
export function filterOrders(orders: Order[], q: string, from: string, to: string): Order[] {
  const needle = q.trim().toLowerCase();
  const fromMs = from ? new Date(`${from}T00:00:00`).getTime() : -Infinity;
  const toMs = to ? new Date(`${to}T23:59:59.999`).getTime() : Infinity;
  return orders.filter((o) => {
    const t = new Date(o.createdAt).getTime();
    if (t < fromMs || t > toMs) return false;
    if (!needle) return true;
    const hay = [o.orderNumber, o.contactSnapshot?.fullName, o.contactSnapshot?.phone, o.shippingAddressSnapshot?.city]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return hay.includes(needle);
  });
}

/** Dynamic-import failures after a redeploy (stale chunk hashes). */
export function isChunkLoadError(err: unknown): boolean {
  const msg = err instanceof Error ? `${err.name} ${err.message}` : String(err);
  return /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk [\w-]+ failed/i.test(
    msg
  );
}
