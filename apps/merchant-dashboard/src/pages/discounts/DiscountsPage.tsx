import { useMemo, useState, type FormEvent } from "react";
import { Alert, Button, Input, Label, Spinner } from "@store-builder/ui";
import type {
  CreateDiscountPayload,
  Discount,
  DiscountStatus,
  DiscountType,
  Product,
  UpdateDiscountPayload,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { getErrorMessage, getFieldErrors } from "@/lib/errors";
import {
  basisPointsToPercentInput,
  formatDate,
  formatMoney,
  formatPercent,
  majorToMinor,
  minorToMajorInput,
  percentToBasisPoints,
} from "@/lib/format";
import { fmt, useCommon, useLocale, useT } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { StatusBadge } from "@/components/StatusBadge";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Field } from "@/components/Field";
import { MoneyInput } from "@/components/MoneyInput";
import { Select } from "@/components/Select";
import { useToast } from "@/components/Toast";
import { FORM_STRINGS, PICKER_STRINGS, STRINGS, TYPE_LABELS } from "./DiscountsPage.strings";

/** Value column: percent for %, money for fixed, a plain caption otherwise. */
function discountValueLabel(d: Discount): string {
  switch (d.type) {
    case "percentage":
      return formatPercent(d.value);
    case "fixed":
      return formatMoney(d.value);
    default:
      return "—";
  }
}

type DisplayStatus = DiscountStatus | "scheduled" | "expired";

/**
 * `active` on the backend just means "not disabled/archived" — a discount
 * with a future start or a past end is still stored as `active`. Compute the
 * status a merchant actually cares about from the date range on top of it.
 */
function displayStatus(d: Discount): DisplayStatus {
  if (d.status !== "active") return d.status;
  const now = Date.now();
  if (d.startsAt && new Date(d.startsAt).getTime() > now) return "scheduled";
  if (d.endsAt && new Date(d.endsAt).getTime() < now) return "expired";
  return "active";
}

function dateRangeLabel(d: Discount, t: Record<"noDateLimit" | "fromDate" | "untilDate", string>): string {
  if (!d.startsAt && !d.endsAt) return t.noDateLimit;
  if (d.startsAt && !d.endsAt) return fmt(t.fromDate, { date: formatDate(d.startsAt) });
  if (!d.startsAt && d.endsAt) return fmt(t.untilDate, { date: formatDate(d.endsAt) });
  return `${formatDate(d.startsAt)} – ${formatDate(d.endsAt)}`;
}

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I — easy to read aloud

function generateCode(): string {
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return out;
}

export function DiscountsPage() {
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const t = useT(STRINGS);
  const c = useCommon();
  const { locale } = useLocale();
  const typeLabel = TYPE_LABELS[locale];
  const list = useAsync(() => apiClient.listDiscounts(workspaceId), [workspaceId]);

  const [formTarget, setFormTarget] = useState<Discount | "new" | null>(null);
  const [deleting, setDeleting] = useState<Discount | null>(null);

  const reload = () => list.refresh({ silent: true });
  const discounts = list.data ?? [];
  const editing = formTarget === "new" ? undefined : formTarget ?? undefined;

  async function toggleStatus(d: Discount) {
    const next = d.status === "active" ? "disabled" : "active";
    try {
      await apiClient.setDiscountStatus(workspaceId, d.id, next);
      toast.success(next === "active" ? t.toastEnabled : t.toastDisabled);
      reload();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    await apiClient.deleteDiscount(workspaceId, deleting.id);
    toast.success(deleting.code ? fmt(t.toastArchivedCode, { code: deleting.code }) : t.toastArchived);
    setDeleting(null);
    reload();
  }

  return (
    <div className="max-w-5xl">
      <PageHeader
        title={t.title}
        description={t.description}
        actions={<Button onClick={() => setFormTarget("new")}>{t.createDiscount}</Button>}
      />

      <DataState
        loading={list.loading}
        error={list.error}
        empty={discounts.length === 0}
        emptyMessage={t.empty}
        onRetry={() => list.refresh()}
      >
        <div className="overflow-x-auto rounded-2xl border border-line bg-paper-raised">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-line bg-paper text-start text-xs uppercase tracking-wide text-ink-soft">
                <th className="px-4 py-3 text-start font-medium">{t.colCode}</th>
                <th className="px-4 py-3 text-start font-medium">{t.colType}</th>
                <th className="px-4 py-3 text-start font-medium">{t.colValue}</th>
                <th className="px-4 py-3 text-start font-medium">{c.status}</th>
                <th className="px-4 py-3 text-start font-medium">{t.colUsage}</th>
                <th className="px-4 py-3 text-start font-medium">{t.colDates}</th>
                <th className="px-4 py-3 font-medium">
                  <span className="sr-only">{c.actions}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {discounts.map((d) => (
                <tr
                  key={d.id}
                  onClick={() => setFormTarget(d)}
                  className="cursor-pointer border-b border-line last:border-0 hover:bg-paper"
                >
                  <td className="px-4 py-3">
                    {d.code ? (
                      <span dir="ltr" className="font-mono font-medium text-ink">
                        {d.code}
                      </span>
                    ) : (
                      <span className="text-ink-soft">{t.automatic}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-ink-soft">{typeLabel[d.type]}</td>
                  <td className="px-4 py-3 text-ink-soft">
                    <bdi dir="ltr" className="tabular-nums">
                      {discountValueLabel(d)}
                    </bdi>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge value={displayStatus(d)} />
                  </td>
                  <td className="px-4 py-3 text-ink-soft">
                    <bdi dir="ltr" className="tabular-nums">
                      {d.usageCount}
                      {d.usageLimit != null ? ` / ${d.usageLimit}` : ""}
                    </bdi>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-ink-soft">{dateRangeLabel(d, t)}</td>
                  <td
                    className="whitespace-nowrap px-4 py-3 text-end"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {d.status !== "archived" && (
                      <Button size="sm" variant="ghost" onClick={() => toggleStatus(d)}>
                        {d.status === "active" ? t.disable : t.enable}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-danger hover:bg-danger-soft"
                      onClick={() => setDeleting(d)}
                    >
                      {c.delete}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DataState>

      <Modal
        open={formTarget !== null}
        onClose={() => setFormTarget(null)}
        title={formTarget === "new" ? t.createDiscount : t.editDiscount}
      >
        {formTarget !== null && (
          <DiscountForm
            key={formTarget === "new" ? "new" : formTarget.id}
            discount={editing}
            onCancel={() => setFormTarget(null)}
            onDone={() => {
              setFormTarget(null);
              reload();
            }}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        title={deleting?.code ? fmt(t.confirmTitleCode, { code: deleting.code }) : t.confirmTitle}
        description={t.confirmDescription}
        confirmLabel={t.confirmLabel}
        destructive
        onCancel={() => setDeleting(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

function DiscountForm({
  discount,
  onDone,
  onCancel,
}: {
  discount?: Discount;
  onDone: () => void;
  onCancel: () => void;
}) {
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const t = useT(FORM_STRINGS);
  const c = useCommon();
  const { locale } = useLocale();
  const typeLabel = TYPE_LABELS[locale];
  const isEdit = Boolean(discount);

  const [code, setCode] = useState(discount?.code ?? "");
  const [type, setType] = useState<DiscountType>(discount?.type ?? "percentage");
  const [value, setValue] = useState(() => {
    if (!discount) return "";
    if (discount.type === "percentage") return basisPointsToPercentInput(discount.value);
    if (discount.type === "fixed") return minorToMajorInput(discount.value);
    return "";
  });
  const [minimumSubtotal, setMinimumSubtotal] = useState(minorToMajorInput(discount?.minimumSubtotal));
  const [startsAt, setStartsAt] = useState(discount?.startsAt ? discount.startsAt.slice(0, 10) : "");
  const [endsAt, setEndsAt] = useState(discount?.endsAt ? discount.endsAt.slice(0, 10) : "");
  const [usageLimit, setUsageLimit] = useState(
    discount?.usageLimit != null ? String(discount.usageLimit) : ""
  );
  const [perCustomerLimit, setPerCustomerLimit] = useState(
    discount?.perCustomerLimit != null ? String(discount.perCustomerLimit) : ""
  );
  const [stackable, setStackable] = useState(discount?.stackable ?? false);
  const [productScope, setProductScope] = useState<"all" | "products">(
    discount && discount.productRestrictions.length > 0 ? "products" : "all"
  );
  const [productIds, setProductIds] = useState<string[]>(discount?.productRestrictions ?? []);

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const needsValue = type === "percentage" || type === "fixed";

  async function submit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});

    let valueNum: number | null = null;
    if (needsValue) {
      valueNum = type === "percentage" ? percentToBasisPoints(value) : majorToMinor(value);
      if (!Number.isFinite(valueNum) || valueNum < 0) {
        setFieldErrors({
          value: type === "percentage" ? t.errPercentRange : t.errAmount,
        });
        return;
      }
      if (type === "percentage" && valueNum > 10000) {
        setFieldErrors({ value: t.errPercentMax });
        return;
      }
    }

    let minSubtotalNum: number | null = null;
    if (minimumSubtotal.trim() !== "") {
      minSubtotalNum = majorToMinor(minimumSubtotal);
      if (!Number.isFinite(minSubtotalNum) || minSubtotalNum < 0) {
        setFieldErrors({ minimumSubtotal: t.errAmount });
        return;
      }
    }

    let usageLimitNum: number | null = null;
    if (usageLimit.trim() !== "") {
      usageLimitNum = Math.floor(Number(usageLimit));
      if (!Number.isFinite(usageLimitNum) || usageLimitNum < 1) {
        setFieldErrors({ usageLimit: t.errWholeNumber });
        return;
      }
    }

    let perCustomerNum: number | null = null;
    if (perCustomerLimit.trim() !== "") {
      perCustomerNum = Math.floor(Number(perCustomerLimit));
      if (!Number.isFinite(perCustomerNum) || perCustomerNum < 1) {
        setFieldErrors({ perCustomerLimit: t.errWholeNumber });
        return;
      }
    }

    if (productScope === "products" && productIds.length === 0) {
      setFieldErrors({ productRestrictions: t.errProducts });
      return;
    }

    const codeValue = code.trim().toUpperCase();
    const restrictions = productScope === "products" ? productIds : [];

    setSaving(true);
    try {
      if (isEdit && discount) {
        const payload: UpdateDiscountPayload = {
          type,
          code: codeValue || null,
          value: needsValue ? valueNum : null,
          minimumSubtotal: minSubtotalNum,
          productRestrictions: restrictions,
          startsAt: startsAt || null,
          endsAt: endsAt || null,
          usageLimit: usageLimitNum,
          perCustomerLimit: perCustomerNum,
          stackable,
        };
        await apiClient.updateDiscount(workspaceId, discount.id, payload);
        toast.success(t.toastSaved);
      } else {
        const payload: CreateDiscountPayload = { type, stackable, productRestrictions: restrictions };
        if (codeValue) payload.code = codeValue;
        if (needsValue && valueNum != null) payload.value = valueNum;
        if (minSubtotalNum != null) payload.minimumSubtotal = minSubtotalNum;
        if (startsAt) payload.startsAt = startsAt;
        if (endsAt) payload.endsAt = endsAt;
        if (usageLimitNum != null) payload.usageLimit = usageLimitNum;
        if (perCustomerNum != null) payload.perCustomerLimit = perCustomerNum;
        await apiClient.createDiscount(workspaceId, payload);
        toast.success(codeValue ? fmt(t.toastCreatedCode, { code: codeValue }) : t.toastCreatedAuto);
      }
      onDone();
    } catch (err) {
      const fields = getFieldErrors(err);
      setFieldErrors(fields);
      if (Object.keys(fields).length === 0) setFormError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {formError && <Alert variant="danger">{formError}</Alert>}

      <Field label={t.code} error={fieldErrors.code} hint={t.codeHint}>
        {({ id, ...aria }) => (
          <div className="flex gap-2">
            <Input
              id={id}
              {...aria}
              dir="ltr"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="SUMMER25"
              className={
                fieldErrors.code
                  ? "font-mono border-danger focus-visible:ring-danger/30"
                  : "font-mono"
              }
            />
            <Button type="button" variant="outline" onClick={() => setCode(generateCode())}>
              {t.generate}
            </Button>
          </div>
        )}
      </Field>

      <Field label={t.type} error={fieldErrors.type}>
        {({ id }) => (
          <Select id={id} value={type} onChange={(e) => setType(e.target.value as DiscountType)}>
            {(Object.keys(typeLabel) as DiscountType[]).map((k) => (
              <option key={k} value={k}>
                {typeLabel[k]}
              </option>
            ))}
          </Select>
        )}
      </Field>

      {type === "percentage" && (
        <Field label={t.percentage} required error={fieldErrors.value} hint={t.percentageHint}>
          {({ id, ...aria }) => (
            <div className="relative" dir="ltr">
              <Input
                id={id}
                {...aria}
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="pe-8"
              />
              <span className="pointer-events-none absolute inset-y-0 end-0 flex items-center pe-3 text-sm text-ink-soft">
                %
              </span>
            </div>
          )}
        </Field>
      )}

      {type === "fixed" && (
        <MoneyInput
          label={t.amountOff}
          required
          value={value}
          onChange={setValue}
          error={fieldErrors.value}
        />
      )}

      <MoneyInput
        label={t.minimumSubtotal}
        value={minimumSubtotal}
        onChange={setMinimumSubtotal}
        error={fieldErrors.minimumSubtotal}
        hint={t.minimumSubtotalHint}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t.startsAt} error={fieldErrors.startsAt}>
          {({ id, ...aria }) => (
            <Input
              id={id}
              {...aria}
              type="date"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
            />
          )}
        </Field>
        <Field label={t.endsAt} error={fieldErrors.endsAt}>
          {({ id, ...aria }) => (
            <Input
              id={id}
              {...aria}
              type="date"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
            />
          )}
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t.usageLimit} error={fieldErrors.usageLimit} hint={t.usageLimitHint}>
          {({ id, ...aria }) => (
            <Input
              id={id}
              {...aria}
              type="number"
              min={1}
              value={usageLimit}
              onChange={(e) => setUsageLimit(e.target.value)}
            />
          )}
        </Field>
        <Field
          label={t.perCustomerLimit}
          error={fieldErrors.perCustomerLimit}
          hint={t.perCustomerLimitHint}
        >
          {({ id, ...aria }) => (
            <Input
              id={id}
              {...aria}
              type="number"
              min={1}
              value={perCustomerLimit}
              onChange={(e) => setPerCustomerLimit(e.target.value)}
            />
          )}
        </Field>
      </div>

      <div className="space-y-2">
        <Label>{t.appliesTo}</Label>
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="radio"
              name="discount-scope"
              checked={productScope === "all"}
              onChange={() => setProductScope("all")}
            />
            {t.allProducts}
          </label>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="radio"
              name="discount-scope"
              checked={productScope === "products"}
              onChange={() => setProductScope("products")}
            />
            {t.specificProducts}
          </label>
          {productScope === "products" && (
            <ProductScopePicker selected={productIds} onChange={setProductIds} />
          )}
        </div>
        {fieldErrors.productRestrictions && (
          <p className="text-xs font-medium text-danger">{fieldErrors.productRestrictions}</p>
        )}
      </div>

      <label className="flex items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          checked={stackable}
          onChange={(e) => setStackable(e.target.checked)}
        />
        {t.stackable}
      </label>

      <div className="flex justify-end gap-3 pt-1">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          {c.cancel}
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? c.saving : isEdit ? t.saveDiscount : t.createDiscount}
        </Button>
      </div>
    </form>
  );
}

/** Checklist of products for the "specific products" discount scope. Fetches
 * one page (up to the backend's max) and filters client-side — matches the
 * catalog list's own local-filter pattern rather than adding pagination to a
 * picker. */
function ProductScopePicker({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const workspaceId = useWorkspaceId();
  const t = useT(PICKER_STRINGS);
  const products = useAsync(
    () => apiClient.listProducts(workspaceId, { limit: 200 }).then((r) => r.products),
    [workspaceId]
  );
  const [search, setSearch] = useState("");

  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const all = products.data ?? [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return all;
    return all.filter((p) => p.name.toLowerCase().includes(q));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, search]);

  function toggle(id: string) {
    onChange(selectedSet.has(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  }

  if (products.loading) return <Spinner className="size-4" />;
  if (products.error) return <p className="text-sm text-danger">{getErrorMessage(products.error)}</p>;

  return (
    <div className="space-y-2 rounded-2xl border border-line p-3">
      <div className="flex items-center justify-between gap-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t.filterPlaceholder}
          aria-label={t.filterPlaceholder}
          className="max-w-xs"
        />
        <span className="whitespace-nowrap text-xs text-ink-soft">
          {fmt(t.selected, { n: selected.length })}
        </span>
      </div>
      {filtered.length === 0 ? (
        <p className="text-sm text-ink-soft">{all.length === 0 ? t.noProducts : t.noMatch}</p>
      ) : (
        <div className="max-h-48 space-y-1 overflow-y-auto">
          {filtered.map((p: Product) => (
            <label
              key={p.id}
              className="flex items-center gap-2 rounded px-1 py-1 text-sm text-ink hover:bg-paper-raised"
            >
              <input type="checkbox" checked={selectedSet.has(p.id)} onChange={() => toggle(p.id)} />
              {p.name}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
