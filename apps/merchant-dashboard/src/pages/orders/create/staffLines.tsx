import type { OrderDraftItem, OrderStaffItem } from "@store-builder/api-client";
import { orderStaffDiscount, orderStaffPriceOverride } from "@store-builder/api-client";
import { useT } from "@/i18n/LocaleContext";
import { useWorkspace } from "@/context/WorkspaceContext";
import { CustomLineAdder, CustomLineBadge, LinePriceField, StaffDiscountField, StaffDiscountRows } from "../staffPricing/StaffPricingFields";
import {
  STAFF_PRICING_STRINGS,
  canOverridePrices,
  customItemOf,
  priceMinorOf,
  staffDiscountInput,
  staffDiscountProblem,
  type StaffCustomLine,
  type StaffDiscountForm,
} from "../staffPricing/staffPricing";
import type { Line, OrderForm } from "./model";
import type { CreateOrder } from "./useCreateOrder";

/**
 * Staff prices on the create-order sheet (handoff 382): how a line of the
 * form is sent — a catalogue line with the staff's price when one is typed, a
 * custom line by its title — and the three controls the sheet mounts. All of
 * it only with `orders.price_override`; every figure is the server's preview.
 */

/** The request's line for a line of the form. A price that is not one is left out: the line stays at the store's price. */
function itemOfLine(line: Line): OrderStaffItem | null {
  if (line.custom) return customItemOf(line.custom, line.quantity);
  const unitPrice = priceMinorOf(line.unitPrice);
  return {
    variantId: line.variantId,
    offerId: line.offerId,
    quantity: line.quantity,
    ...(unitPrice !== undefined && !Number.isNaN(unitPrice) ? { unitPrice } : {}),
  };
}

/** The form's lines as the preview and the create request take them, in the form's order. */
export function staffItemsOf(lines: readonly Line[]): OrderDraftItem[] {
  return lines.map(itemOfLine).filter((item): item is OrderStaffItem => item !== null) as unknown as OrderDraftItem[];
}

/** `{ manualDiscount }` when a complete staff discount is typed; nothing otherwise. */
export function staffDiscountOf(form: Pick<OrderForm, "staffDiscount">): { manualDiscount?: ReturnType<typeof staffDiscountInput> } {
  const input = staffDiscountInput(form.staffDiscount);
  return input ? { manualDiscount: input } : {};
}

/** Why the order cannot be created as typed (a staff discount without its reason, say), in words; null when it can. */
export function useStaffPricingProblem(): (form: OrderForm) => string | null {
  const t = useT(STAFF_PRICING_STRINGS);
  return (form) => {
    const problem = staffDiscountProblem(form.staffDiscount);
    if (problem) return t[problem];
    return form.lines.some((line) => !line.custom && line.unitPrice !== undefined && line.unitPrice.trim() !== "" && Number.isNaN(priceMinorOf(line.unitPrice)))
      ? t.priceInvalid
      : null;
  };
}

/** A line kept in the tab's draft: its staff price and, for a custom line, what was typed. */
export function draftLineExtras(raw: Record<string, unknown>): Pick<Line, "unitPrice" | "custom"> {
  const out: Pick<Line, "unitPrice" | "custom"> = {};
  if (typeof raw.unitPrice === "string" && raw.unitPrice !== "") out.unitPrice = raw.unitPrice.slice(0, 20);
  const custom = raw.custom as Record<string, unknown> | null | undefined;
  if (custom && typeof custom === "object" && typeof custom.title === "string" && custom.title.trim() !== "") {
    const text = (value: unknown, max: number) => (typeof value === "string" ? value.slice(0, max) : "");
    out.custom = { title: custom.title.slice(0, 300), unitPrice: text(custom.unitPrice, 20), sku: text(custom.sku, 100), weightGrams: text(custom.weightGrams, 7) };
  }
  return out;
}

/** The staff discount kept in the tab's draft, or undefined. */
export function draftStaffDiscount(raw: unknown): StaffDiscountForm | undefined {
  const value = raw as Record<string, unknown> | null | undefined;
  if (!value || typeof value !== "object") return undefined;
  const text = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
  return { type: value.type === "percent" ? "percent" : "amount", value: text(value.value, 20), reason: text(value.reason, 500) };
}

export function useCanOverridePrices(): boolean {
  const { currentWorkspace } = useWorkspace();
  return canOverridePrices(currentWorkspace?.role);
}

/** Under a line's name: «مخصص» for a custom line; for a catalogue line, the pencil that changes its price. */
export function LineStaffPrice({ ctl, line, index, name }: { ctl: CreateOrder; line: Line; index: number; name: string }) {
  const allowed = useCanOverridePrices();
  if (line.custom) return <CustomLineBadge className="mt-1" />;
  if (!allowed) return null;
  const priced = ctl.pricedLine(index);
  const override = orderStaffPriceOverride(priced);
  return (
    <LinePriceField
      className="mt-0.5"
      name={name}
      value={line.unitPrice}
      onChange={(next) => ctl.patchForm({ lines: ctl.form.lines.map((l) => (l.key === line.key ? { ...l, unitPrice: next } : l)) })}
      pricedMinor={priced?.unitPriceAmount}
      catalogMinor={override?.kind === "override" ? override.catalogUnitPriceAmount : null}
      currency={ctl.currency}
    />
  );
}

/** «+ سطر مخصص» under the lines of the order. */
export function CustomLineControl({ ctl }: { ctl: CreateOrder }) {
  const allowed = useCanOverridePrices();
  if (!allowed) return null;
  function add(custom: StaffCustomLine, quantity: number) {
    const lines = ctl.form.lines;
    ctl.patchForm({ lines: [...lines, { key: `custom-${Date.now()}-${lines.length}`, productId: "", variantId: "", quantity, custom }] });
  }
  return <CustomLineAdder onAdd={add} currency={ctl.currency} />;
}

/** «+ خصم يدوي» beside the discount code on the last step. */
export function StaffDiscountControl({ ctl }: { ctl: CreateOrder }) {
  const allowed = useCanOverridePrices();
  if (!allowed && !ctl.form.staffDiscount) return null;
  return (
    <StaffDiscountField
      value={ctl.form.staffDiscount ?? null}
      onChange={(next) => ctl.patchForm({ staffDiscount: next })}
      currency={ctl.currency}
      showProblems={Boolean(ctl.formError)}
    />
  );
}

/** The summary's discount: one row, or the code's and the staff's as two. */
export function SummaryDiscountRows({ ctl, label }: { ctl: CreateOrder; label: string }) {
  const preview = ctl.preview;
  if (!preview) return null;
  return (
    <StaffDiscountRows discountAmount={preview.discountAmount} manual={orderStaffDiscount(preview)} currency={ctl.currency} discountLabel={label} stale={ctl.pricing} />
  );
}
