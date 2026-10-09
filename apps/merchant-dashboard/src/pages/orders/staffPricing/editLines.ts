import {
  apiFieldProblems,
  orderStaffDiscount,
  orderStaffPriceOverride,
  type Order,
  type OrderStaffDiscountInput,
  type OrderStaffItem,
  type OrderStaffItemsEdit,
  type OrderStaffItemsPreview,
} from "@store-builder/api-client";
import { formatOptions, minorToMajorInput } from "@/lib/format";
import { isPermissionError } from "@/lib/errors";
import {
  customItemOf,
  priceMinorOf,
  staffDiscountInput,
  staffDiscountProblem,
  type StaffCustomLine,
  type StaffDiscountForm,
  type StaffPricingStrings,
} from "./staffPricing";

/**
 * «تعديل المنتجات» with staff prices (handoff 382): the dialog's lines, how
 * they are sent, and which line of the server's preview prices each.
 *
 * A line the order already has keeps the price it was sold at unless staff
 * type another. A custom line the order already has goes back with its
 * `orderItemId` — leaving it out would remove it.
 */
export interface StaffEditLine {
  key: string;
  /** Empty for a custom line. */
  variantId: string;
  offerId: string | null;
  quantity: number;
  label: string;
  /** The staff's own unit price, major units as typed; unset = as it was (or the store's price for a new line). */
  unitPrice?: string;
  custom?: StaffCustomLine;
}

/** The order's lines as the dialog starts with them: its catalogue lines, and its custom lines by id. */
export function editLinesOf(order: Order): StaffEditLine[] {
  const lines: StaffEditLine[] = [];
  for (const item of order.items) {
    if (item.variantId) {
      lines.push({
        key: item.id,
        variantId: item.variantId,
        offerId: item.offerId ?? null,
        quantity: item.quantity,
        label: [item.productNameSnapshot, formatOptions(item.variantOptionsSnapshot), item.offerNameSnapshot].filter(Boolean).join(" · "),
      });
    } else if (orderStaffPriceOverride(item)?.kind === "custom") {
      lines.push({
        key: item.id,
        variantId: "",
        offerId: null,
        quantity: item.quantity,
        label: item.productNameSnapshot,
        // No weight: re-sent without one, a kept line keeps the weight it had.
        custom: { orderItemId: item.id, title: item.productNameSnapshot, unitPrice: minorToMajorInput(item.unitPriceAmount), sku: item.skuSnapshot ?? "", weightGrams: "" },
      });
    }
  }
  return lines;
}

export function editItemsOf(lines: readonly StaffEditLine[]): OrderStaffItem[] {
  const items: OrderStaffItem[] = [];
  for (const line of lines) {
    if (line.custom) {
      const item = customItemOf(line.custom, line.quantity);
      if (item) items.push(item);
      continue;
    }
    const unitPrice = priceMinorOf(line.unitPrice);
    items.push({
      variantId: line.variantId,
      ...(line.offerId ? { offerId: line.offerId } : {}),
      quantity: line.quantity,
      ...(unitPrice !== undefined && !Number.isNaN(unitPrice) ? { unitPrice } : {}),
    });
  }
  return items;
}

/** The order's staff discount as the dialog's form, or null when it has none. */
export function discountFormOf(order: Order): StaffDiscountForm | null {
  const manual = orderStaffDiscount(order);
  if (!manual) return null;
  return { type: manual.type, value: manual.type === "percent" ? String(manual.value) : minorToMajorInput(manual.value), reason: manual.reason };
}

/**
 * The request for the lines and the staff discount as they stand. An
 * untouched discount is left out (the order's stays, a percent worked out
 * again on the new subtotal); removed, it goes as null; typed but incomplete,
 * it is left out too — the dialog does not save until it is complete.
 */
export function staffEditOf(lines: readonly StaffEditLine[], discount: StaffDiscountForm | null, discountTouched: boolean): OrderStaffItemsEdit {
  const items = editItemsOf(lines);
  if (!discountTouched) return { items };
  if (discount === null) return { items, manualDiscount: null };
  const input: OrderStaffDiscountInput | null = staffDiscountInput(discount);
  return input ? { items, manualDiscount: input } : { items };
}

/** A staff discount that was touched and cannot be sent yet. */
export function staffEditBlocked(discount: StaffDiscountForm | null, discountTouched: boolean): boolean {
  return discountTouched && discount !== null && staffDiscountProblem(discount) !== null;
}

type PreviewLine = OrderStaffItemsPreview["items"][number];

/** The preview's line for a line of the dialog: a catalogue line by its variant and offer, a custom line by its place among the custom ones. */
export function pricedEditLine(preview: OrderStaffItemsPreview | null, lines: readonly StaffEditLine[], line: StaffEditLine): PreviewLine | undefined {
  if (!preview) return undefined;
  if (!line.custom) return preview.items.find((i) => i.variantId === line.variantId && (i.offerId ?? "") === (line.offerId ?? ""));
  const nth = lines.filter((l) => l.custom).indexOf(line);
  return preview.items.filter((i) => !i.variantId)[nth];
}

/** A staff-pricing refusal in the merchant's words, or null for any other failure. */
export function staffPricingError(err: unknown, t: StaffPricingStrings): string | null {
  if (isPermissionError(err)) return t.forbidden;
  for (const problem of apiFieldProblems(err)) {
    if (problem.field === "manualDiscount.reason") return t.reasonMissing;
    if (problem.field === "manualDiscount.value") return /percent/i.test(problem.message) ? t.percentInvalid : t.amountInvalid;
    if (problem.field === "items.orderItemId") return t.lineNotOnOrder;
    if (/^items\.\d+$/.test(problem.field)) return t.priceInvalid;
  }
  return null;
}
