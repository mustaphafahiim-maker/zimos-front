import { useId, useState } from "react";
import { Button, Input, cn } from "@store-builder/ui";
import type { OrderStaffDiscount } from "@store-builder/api-client";
import { IconClose, IconEdit } from "@/components/icons";
import { Field } from "@/components/Field";
import { Segmented } from "@/components/Segmented";
import { StatusBadge } from "@/components/StatusBadge";
import { fmt, useT } from "@/i18n/LocaleContext";
import { formatMoney, minorToMajorInput } from "@/lib/format";
import { asciiDigits } from "@/lib/wholeNumber";
import {
  STAFF_PRICING_STRINGS,
  priceMinorOf,
  staffDiscountProblem,
  typedMoney,
  type StaffCustomLine,
  type StaffDiscountForm,
} from "./staffPricing";

const FIELD = "h-11 text-base tabular-nums md:h-10 md:text-sm";

/** «مخصص»: a line that is not in the catalogue. */
export function CustomLineBadge({ className }: { className?: string }) {
  const t = useT(STAFF_PRICING_STRINGS);
  return <StatusBadge value="custom" tone="info" text={t.custom} className={className} />;
}

/**
 * A line's unit price, for staff who may change it: a small pencil «تعديل
 * السعر» that turns the price into a field. Once changed, the store's own
 * price shows struck through beside it, with the way back to it.
 *
 * `value` is what was typed (major units), undefined while the line sells at
 * the store's price. `pricedMinor` is the unit price the server last priced
 * the line at (the field starts from it); `catalogMinor` is the store's price
 * for a changed line, as the preview answers it.
 */
export function LinePriceField({
  name,
  value,
  onChange,
  pricedMinor,
  catalogMinor,
  currency,
  disabled = false,
  className,
}: {
  name: string;
  value: string | undefined;
  onChange: (next: string | undefined) => void;
  pricedMinor: string | number | null | undefined;
  catalogMinor: string | number | null | undefined;
  currency: string;
  disabled?: boolean;
  className?: string;
}) {
  const t = useT(STAFF_PRICING_STRINGS);
  const id = useId();
  const editing = value !== undefined;
  const minor = priceMinorOf(value);
  const invalid = editing && value.trim() !== "" && Number.isNaN(minor);

  if (!editing) {
    return (
      <button
        type="button"
        data-slot="line-price-edit"
        disabled={disabled}
        onClick={() => onChange(pricedMinor !== null && pricedMinor !== undefined ? minorToMajorInput(pricedMinor) : "")}
        aria-label={fmt(t.changePriceOf, { name })}
        title={t.changePrice}
        className={cn(
          "inline-flex min-h-11 cursor-pointer items-center gap-1 rounded-full px-2 text-xs font-medium text-primary hover:bg-primary-soft focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50 pointer-fine:min-h-8",
          className
        )}
      >
        <IconEdit className="size-3.5" aria-hidden />
        {t.changePrice}
      </button>
    );
  }

  return (
    <span data-slot="line-price" className={cn("inline-flex flex-wrap items-center gap-x-2 gap-y-1", className)}>
      <label htmlFor={id} className="sr-only">
        {fmt(t.priceOf, { name })}
      </label>
      <Input
        id={id}
        dir="ltr"
        inputMode="decimal"
        autoComplete="off"
        value={value}
        disabled={disabled}
        aria-invalid={invalid ? true : undefined}
        title={invalid ? t.priceInvalid : undefined}
        onChange={(e) => onChange(typedMoney(e.target.value))}
        className={cn(FIELD, "w-28", invalid && "border-danger focus-visible:ring-danger/30")}
      />
      {catalogMinor !== null && catalogMinor !== undefined && (
        <span className="text-xs text-ink-soft">
          <s>
            <bdi>{fmt(t.storePrice, { catalogue: formatMoney(catalogMinor, currency) })}</bdi>
          </s>
        </span>
      )}
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(undefined)}
        aria-label={t.backToStorePrice}
        title={t.backToStorePrice}
        className="flex size-11 cursor-pointer items-center justify-center rounded-full text-ink-soft hover:bg-ink/8 hover:text-ink focus-visible:outline-2 focus-visible:outline-primary pointer-fine:size-8"
      >
        <IconClose className="size-3.5" aria-hidden />
      </button>
      {invalid && (
        <span role="alert" className="basis-full text-xs font-medium text-danger">
          {t.priceInvalid}
        </span>
      )}
    </span>
  );
}

const NEW_CUSTOM: StaffCustomLine = { title: "", unitPrice: "", sku: "", weightGrams: "" };

/** «+ سطر مخصص»: opens a row for a line that is not in the catalogue — what it is, its price, how many, and optionally a SKU and a weight. */
export function CustomLineAdder({ onAdd, currency }: { onAdd: (line: StaffCustomLine, quantity: number) => void; currency: string }) {
  const t = useT(STAFF_PRICING_STRINGS);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<StaffCustomLine>(NEW_CUSTOM);
  const [quantity, setQuantity] = useState("1");
  const [tried, setTried] = useState(false);

  if (!open) {
    return (
      <Button type="button" variant="outline" data-slot="custom-line-open" className="min-h-11 rounded-full px-4" onClick={() => setOpen(true)}>
        {t.addCustom}
      </Button>
    );
  }

  const price = priceMinorOf(draft.unitPrice);
  const priceBad = price === undefined || Number.isNaN(price);
  const grams = asciiDigits(draft.weightGrams).trim();
  const weightBad = grams !== "" && !/^\d{1,7}$/.test(grams);
  const titleBad = draft.title.trim() === "";

  function add() {
    setTried(true);
    if (titleBad || priceBad || weightBad) return;
    onAdd(draft, Math.min(9999, Math.max(1, Math.floor(Number(asciiDigits(quantity)) || 1))));
    setDraft(NEW_CUSTOM);
    setQuantity("1");
    setTried(false);
    setOpen(false);
  }

  return (
    <fieldset data-slot="custom-line-form" className="space-y-3 rounded-[1rem] bg-paper-raised p-3.5 ring-1 ring-line">
      <legend className="sr-only">{t.addCustom}</legend>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <Field label={t.customTitle} error={tried && titleBad ? t.customTitleMissing : undefined}>
          {({ id, ...aria }) => (
            <Input id={id} {...aria} dir="auto" autoFocus maxLength={300} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className={FIELD} />
          )}
        </Field>
        <Field label={`${t.customPrice} (${currency})`} error={tried && priceBad ? t.priceInvalid : undefined}>
          {({ id, ...aria }) => (
            <Input
              id={id}
              {...aria}
              dir="ltr"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0.00"
              value={draft.unitPrice}
              onChange={(e) => setDraft({ ...draft, unitPrice: typedMoney(e.target.value) })}
              className={FIELD}
            />
          )}
        </Field>
        <Field label={t.customQuantity}>
          {({ id }) => (
            <Input id={id} dir="ltr" inputMode="numeric" autoComplete="off" maxLength={4} value={quantity} onChange={(e) => setQuantity(asciiDigits(e.target.value).replace(/\D/g, ""))} className={FIELD} />
          )}
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t.customSku}>
          {({ id }) => <Input id={id} dir="ltr" autoComplete="off" maxLength={100} value={draft.sku} onChange={(e) => setDraft({ ...draft, sku: e.target.value })} className={FIELD} />}
        </Field>
        <Field label={t.customWeight} error={tried && weightBad ? t.customWeightInvalid : undefined}>
          {({ id, ...aria }) => (
            <Input
              id={id}
              {...aria}
              dir="ltr"
              inputMode="numeric"
              autoComplete="off"
              maxLength={7}
              value={draft.weightGrams}
              onChange={(e) => setDraft({ ...draft, weightGrams: asciiDigits(e.target.value).replace(/\D/g, "") })}
              className={FIELD}
            />
          )}
        </Field>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" className="min-h-11 rounded-full px-4" onClick={() => setOpen(false)}>
          {t.customCancel}
        </Button>
        <Button type="button" data-slot="custom-line-add" className="min-h-11 rounded-full px-4" onClick={add}>
          {t.customAdd}
        </Button>
      </div>
    </fieldset>
  );
}

/**
 * «+ خصم يدوي»: a discount off the whole order — an amount or a percentage,
 * and the reason (required; it is kept on the order). `value` null = none.
 */
export function StaffDiscountField({
  value,
  onChange,
  currency,
  showProblems = false,
  disabled = false,
}: {
  value: StaffDiscountForm | null;
  onChange: (next: StaffDiscountForm | null) => void;
  currency: string;
  /** Say what is missing under the fields (after a save was tried); until then only once something was typed. */
  showProblems?: boolean;
  disabled?: boolean;
}) {
  const t = useT(STAFF_PRICING_STRINGS);
  if (!value) {
    return (
      <Button
        type="button"
        variant="outline"
        data-slot="staff-discount-open"
        disabled={disabled}
        className="min-h-11 rounded-full px-4"
        onClick={() => onChange({ type: "amount", value: "", reason: "" })}
      >
        {t.addDiscount}
      </Button>
    );
  }

  const problem = staffDiscountProblem(value);
  const valueProblem = problem === "percentInvalid" || problem === "amountInvalid" ? t[problem] : undefined;
  const typedValue = value.value.trim() !== "";

  return (
    <fieldset data-slot="staff-discount" aria-label={t.discountTitle} disabled={disabled} className="space-y-3 rounded-[1rem] bg-paper-raised p-3.5 ring-1 ring-line">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-ink">{t.discountTitle}</p>
        <Button type="button" variant="ghost" data-slot="staff-discount-remove" className="min-h-11 rounded-full px-3 text-danger hover:bg-danger-soft pointer-fine:min-h-9" onClick={() => onChange(null)}>
          {t.removeDiscount}
        </Button>
      </div>
      <Segmented<StaffDiscountForm["type"]>
        label={t.discountKind}
        value={value.type}
        onChange={(type) => onChange({ ...value, type })}
        options={[
          { value: "amount", label: t.amount },
          { value: "percent", label: t.percent },
        ]}
      />
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Field
          label={value.type === "percent" ? `${t.discountValue} (%)` : `${t.discountValue} (${currency})`}
          error={valueProblem && (showProblems || typedValue) ? valueProblem : undefined}
        >
          {({ id, ...aria }) => (
            <Input
              id={id}
              {...aria}
              dir="ltr"
              inputMode="decimal"
              autoComplete="off"
              value={value.value}
              onChange={(e) => onChange({ ...value, value: typedMoney(e.target.value) })}
              className={FIELD}
            />
          )}
        </Field>
        <Field label={t.reason} required error={problem === "reasonMissing" && showProblems ? t.reasonMissing : undefined}>
          {({ id, ...aria }) => (
            <Input id={id} {...aria} dir="auto" maxLength={500} value={value.reason} onChange={(e) => onChange({ ...value, reason: e.target.value })} className={FIELD} />
          )}
        </Field>
      </div>
    </fieldset>
  );
}

/**
 * The discount of an order's totals as two rows where there is a staff
 * discount: «كود الخصم» (what is left of `discountAmount`) and «خصم يدوي
 * (السبب)». With no staff discount, the one row the screen always showed.
 */
export function StaffDiscountRows({
  discountAmount,
  manual,
  currency,
  discountLabel,
  stale = false,
  className,
}: {
  /** The code's discount plus the staff one, minor units. */
  discountAmount: string | number;
  manual: OrderStaffDiscount | null;
  currency: string;
  /** The label of the single row when there is no staff discount. */
  discountLabel: string;
  stale?: boolean;
  className?: string;
}) {
  const t = useT(STAFF_PRICING_STRINGS);
  const total = Number(discountAmount) || 0;
  const staff = manual ? Number(manual.amount) || 0 : 0;
  const coupon = Math.max(0, total - staff);
  const row = (label: string, minor: number, slot: string) => (
    <div data-slot={slot} className={cn("flex justify-between gap-3", className)}>
      <dt className="min-w-0 text-ink-soft" dir="auto">
        {label}
      </dt>
      <dd className={cn("shrink-0 text-ink tabular-nums", stale && "opacity-60")}>
        <bdi>−{formatMoney(minor, currency)}</bdi>
      </dd>
    </div>
  );
  if (!manual) return total > 0 ? row(discountLabel, total, "discount-row") : null;
  return (
    <>
      {coupon > 0 && row(t.discountCode, coupon, "discount-code-row")}
      {row(fmt(t.staffDiscountRow, { reason: manual.reason }), staff, "staff-discount-row")}
    </>
  );
}
