import type { PaymentMethod } from "@store-builder/api-client";
import { EMPTY_FORM, clampQuantity, isFormEmpty, type Line, type OrderForm, type StepIndex } from "./model";
import { draftLineExtras, draftStaffDiscount } from "./staffLines";

/**
 * The order being typed, kept for the tab so nothing is lost when the sheet is
 * closed, the page is left or the browser reloads. One draft per store, in
 * sessionStorage: a new tab starts clean. Only what was typed is kept — ids and
 * quantities for the products, never the product objects or a price.
 */
const VERSION = 1;

function keyOf(workspaceId: string): string {
  return `zimos.order.draft.${workspaceId}`;
}

export interface OrderDraftSnapshot {
  form: OrderForm;
  step: StepIndex;
}

function text(value: unknown, max = 2000): string {
  return typeof value === "string" ? value.slice(0, max) : "";
}

function lineOf(value: unknown, index: number): Line | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  // Handoff 382: a custom line has no product; it is kept by what was typed.
  const extras = draftLineExtras(raw);
  if (extras.custom) return { key: `draft-${index}`, productId: "", variantId: "", quantity: clampQuantity(Number(raw.quantity)), custom: extras.custom };
  if (typeof raw.productId !== "string" || typeof raw.variantId !== "string" || raw.variantId === "") return null;
  return {
    ...extras,
    key: `draft-${index}`,
    productId: raw.productId,
    variantId: raw.variantId,
    offerId: typeof raw.offerId === "string" && raw.offerId !== "" ? raw.offerId : undefined,
    offerName: typeof raw.offerName === "string" && raw.offerName !== "" ? raw.offerName : undefined,
    quantity: clampQuantity(Number(raw.quantity)),
  };
}

/** The draft kept for this store, or null: nothing kept, storage blocked, or something that is not a draft. */
export function readDraft(workspaceId: string): OrderDraftSnapshot | null {
  if (!workspaceId) return null;
  try {
    const stored = window.sessionStorage.getItem(keyOf(workspaceId));
    if (!stored) return null;
    const parsed = JSON.parse(stored) as { v?: unknown; step?: unknown; form?: unknown } | null;
    if (!parsed || parsed.v !== VERSION || !parsed.form || typeof parsed.form !== "object") return null;
    const raw = parsed.form as Record<string, unknown>;
    const lines = Array.isArray(raw.lines)
      ? raw.lines.map(lineOf).filter((line): line is Line => line !== null)
      : [];
    const form: OrderForm = {
      phone: text(raw.phone, 40),
      fullName: text(raw.fullName, 200),
      email: text(raw.email, 200),
      province: text(raw.province, 200),
      city: text(raw.city, 200),
      addressLine: text(raw.addressLine, 500),
      lines,
      paymentMethod: typeof raw.paymentMethod === "string" && raw.paymentMethod !== "" ? (raw.paymentMethod as PaymentMethod) : EMPTY_FORM.paymentMethod,
      notes: text(raw.notes),
      coupon: text(raw.coupon, 100),
      appliedCoupon: text(raw.appliedCoupon, 100),
      shipping: text(raw.shipping, 20),
      staffDiscount: draftStaffDiscount(raw.staffDiscount),
    };
    if (isFormEmpty(form)) return null;
    const step: StepIndex = parsed.step === 1 ? 1 : parsed.step === 2 ? 2 : 0;
    return { form, step };
  } catch {
    return null;
  }
}

/** Keeps the form as it is now; an empty form removes the draft instead. */
export function writeDraft(workspaceId: string, snapshot: OrderDraftSnapshot): void {
  if (!workspaceId) return;
  if (isFormEmpty(snapshot.form)) {
    clearDraft(workspaceId);
    return;
  }
  try {
    const form = {
      ...snapshot.form,
      lines: snapshot.form.lines.map(({ productId, variantId, offerId, offerName, quantity, unitPrice, custom }) => ({
        productId,
        variantId,
        offerId,
        offerName,
        quantity,
        unitPrice,
        custom,
      })),
    };
    window.sessionStorage.setItem(keyOf(workspaceId), JSON.stringify({ v: VERSION, step: snapshot.step, form }));
  } catch {
    // Private mode or a full store: the form still works, it is only not kept.
  }
}

export function clearDraft(workspaceId: string): void {
  if (!workspaceId) return;
  try {
    window.sessionStorage.removeItem(keyOf(workspaceId));
  } catch {
    // Nothing to remove where nothing could be kept.
  }
}
