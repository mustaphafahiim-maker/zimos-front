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
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { StatusBadge } from "@/components/StatusBadge";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Field } from "@/components/Field";
import { CouponLinkDialog } from "./CouponLinkDialog";
import { MoneyInput } from "@/components/MoneyInput";
import { Select } from "@/components/Select";
import { useToast } from "@/components/Toast";
import { BulkCodesButton } from "./BulkCodesDialog";

const STRINGS = {
  en: {
    title: "Discounts",
    description: "Codes and automatic discounts applied at checkout.",
    create: "Create discount",
    empty: "No discounts yet. Create your first one.",
    code: "Code",
    type: "Type",
    value: "Value",
    status: "Status",
    usage: "Usage",
    dates: "Dates",
    automatic: "Automatic",
    type_percentage: "Percentage off",
    type_fixed: "Fixed amount off",
    type_free_shipping: "Free shipping",
    type_buy_x_get_y: "Buy X get Y",
    status_active: "Active",
    status_disabled: "Disabled",
    status_archived: "Archived",
    status_scheduled: "Scheduled",
    status_expired: "Expired",
    noDateLimit: "No date limit",
    dateFrom: "From {date}",
    dateUntil: "Until {date}",
    enable: "Enable",
    disable: "Disable",
    delete: "Delete",
    shareLink: "Share link",
    enabledToast: "Discount enabled.",
    disabledToast: "Discount disabled.",
    archivedToast: "Discount archived.",
    archivedCodeToast: '"{code}" archived.',
    editTitle: "Edit discount",
    archiveTitle: "Archive this discount?",
    archiveTitleCode: 'Archive "{code}"?',
    archiveDescription:
      "A discount that has been redeemed is financial history, so it's archived rather than deleted — it stops applying at checkout and drops off active reporting.",
    archiveConfirm: "Archive discount",
    working: "Working…",
    cancel: "Cancel",
    percentInvalid: "Enter a percentage between 0 and 100.",
    amountInvalid: "Enter a valid amount.",
    percentTooHigh: "A percentage discount can't exceed 100%.",
    limitInvalid: "Enter a whole number of 1 or more.",
    productsRequired: "Select at least one product, or switch to all products.",
    savedToast: "Discount saved.",
    createdCodeToast: '"{code}" created.',
    createdAutomaticToast: "Automatic discount created.",
    codeHint: "Leave blank for an automatic discount with no code.",
    generate: "Generate",
    percentage: "Percentage",
    percentageHint: "Between 0 and 100.",
    amountOff: "Amount off",
    minimumSubtotal: "Minimum subtotal",
    minimumSubtotalHint: "Optional — the order subtotal must reach this before the discount applies.",
    startsAt: "Starts at",
    endsAt: "Ends at",
    usageLimit: "Usage limit",
    usageLimitHint: "Total redemptions allowed.",
    perCustomerLimit: "Per-customer limit",
    perCustomerLimitHint: "Redemptions allowed per customer.",
    appliesTo: "Applies to",
    allProducts: "All products",
    specificProducts: "Specific products",
    stackable: "Can be combined with other discounts",
    saving: "Saving…",
    save: "Save discount",
    loading: "Loading",
    filterProducts: "Filter products…",
    selectedCount: "{count} selected",
    noProducts: "No products yet — add one in Catalog first.",
    noMatch: "No products match.",
  },
  ar: {
    title: "الخصومات",
    description: "أكواد الخصم والخصومات التلقائية التي تُطبَّق عند إتمام الطلب.",
    create: "إنشاء خصم",
    empty: "لا توجد خصومات بعد. أنشئ أول خصم.",
    code: "الكود",
    type: "النوع",
    value: "القيمة",
    status: "الحالة",
    usage: "الاستخدام",
    dates: "الفترة",
    automatic: "تلقائي",
    type_percentage: "خصم بنسبة",
    type_fixed: "خصم بمبلغ ثابت",
    type_free_shipping: "شحن مجاني",
    type_buy_x_get_y: "اشترِ X واحصل على Y",
    status_active: "مفعّل",
    status_disabled: "متوقف",
    status_archived: "مؤرشف",
    status_scheduled: "مجدول",
    status_expired: "منتهي",
    noDateLimit: "بدون تاريخ محدد",
    dateFrom: "من {date}",
    dateUntil: "حتى {date}",
    enable: "تفعيل",
    disable: "إيقاف",
    delete: "حذف",
    shareLink: "لينك المشاركة",
    enabledToast: "تم تفعيل الخصم.",
    disabledToast: "تم إيقاف الخصم.",
    archivedToast: "تمت أرشفة الخصم.",
    archivedCodeToast: "تمت أرشفة «{code}».",
    editTitle: "تعديل الخصم",
    archiveTitle: "أرشفة هذا الخصم؟",
    archiveTitleCode: "أرشفة «{code}»؟",
    archiveDescription:
      "الخصم الذي استخدمه العملاء جزء من السجل المالي، لذلك تتم أرشفته وليس حذفه — يتوقف تطبيقه عند إتمام الطلب ولا يظهر بعدها في التقارير النشطة.",
    archiveConfirm: "أرشفة الخصم",
    working: "بنأرشف…",
    cancel: "إلغاء",
    percentInvalid: "أدخل نسبة بين 0 و100.",
    amountInvalid: "أدخل مبلغًا صحيحًا.",
    percentTooHigh: "نسبة الخصم لا يمكن أن تزيد عن 100%.",
    limitInvalid: "أدخل رقمًا صحيحًا، 1 أو أكثر.",
    productsRequired: "اختر منتجًا واحدًا على الأقل، أو اختر «كل المنتجات».",
    savedToast: "تم حفظ الخصم.",
    createdCodeToast: "تم إنشاء «{code}».",
    createdAutomaticToast: "تم إنشاء خصم تلقائي.",
    codeHint: "اتركه فارغًا لإنشاء خصم تلقائي بدون كود.",
    generate: "توليد",
    percentage: "النسبة",
    percentageHint: "بين 0 و100.",
    amountOff: "مبلغ الخصم",
    minimumSubtotal: "الحد الأدنى للطلب",
    minimumSubtotalHint: "اختياري — يجب أن يصل المجموع الفرعي للطلب إلى هذا المبلغ حتى يُطبَّق الخصم.",
    startsAt: "تاريخ البداية",
    endsAt: "تاريخ النهاية",
    usageLimit: "حد الاستخدام",
    usageLimitHint: "إجمالي عدد مرات الاستخدام المسموح بها.",
    perCustomerLimit: "الحد لكل عميل",
    perCustomerLimitHint: "عدد مرات الاستخدام المسموح بها لكل عميل.",
    appliesTo: "يُطبَّق على",
    allProducts: "كل المنتجات",
    specificProducts: "منتجات محددة",
    stackable: "يمكن استخدامه مع خصومات أخرى",
    saving: "بنحفظ…",
    save: "حفظ الخصم",
    loading: "بنحمّل",
    filterProducts: "ابحث في المنتجات…",
    selectedCount: "اخترت {count}",
    noProducts: "لا توجد منتجات بعد — أضف منتجًا من صفحة المنتجات أولًا.",
    noMatch: "لا توجد منتجات مطابقة.",
  },
} satisfies Messages;

type Strings = (typeof STRINGS)["en"];

/** Discount type -> its label key in STRINGS. */
const TYPE_LABEL: Record<DiscountType, keyof Strings> = {
  percentage: "type_percentage",
  fixed: "type_fixed",
  free_shipping: "type_free_shipping",
  buy_x_get_y: "type_buy_x_get_y",
};

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

function dateRangeLabel(d: Discount, t: Strings): string {
  if (!d.startsAt && !d.endsAt) return t.noDateLimit;
  if (d.startsAt && !d.endsAt) return fmt(t.dateFrom, { date: formatDate(d.startsAt) });
  if (!d.startsAt && d.endsAt) return fmt(t.dateUntil, { date: formatDate(d.endsAt) });
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
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const list = useAsync(() => apiClient.listDiscounts(workspaceId), [workspaceId]);

  const [formTarget, setFormTarget] = useState<Discount | "new" | null>(null);
  const [deleting, setDeleting] = useState<Discount | null>(null);
  const [sharing, setSharing] = useState<Discount | null>(null);

  const reload = () => list.refresh({ silent: true });
  const discounts = list.data ?? [];
  const editing = formTarget === "new" ? undefined : formTarget ?? undefined;

  async function toggleStatus(d: Discount) {
    const next = d.status === "active" ? "disabled" : "active";
    try {
      await apiClient.setDiscountStatus(workspaceId, d.id, next);
      toast.success(next === "active" ? t.enabledToast : t.disabledToast);
      reload();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    await apiClient.deleteDiscount(workspaceId, deleting.id);
    toast.success(deleting.code ? fmt(t.archivedCodeToast, { code: deleting.code }) : t.archivedToast);
    setDeleting(null);
    reload();
  }

  return (
    <div className="max-w-5xl">
      <PageHeader
        title={t.title}
        description={t.description}
        actions={
          <>
            <BulkCodesButton onGenerated={reload} />
            <Button onClick={() => setFormTarget("new")}>{t.create}</Button>
          </>
        }
      />

      <DataState
        loading={list.loading}
        error={list.error}
        empty={discounts.length === 0}
        emptyMessage={t.empty}
        onRetry={() => list.refresh()}
      >
        <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-line bg-paper-raised text-start text-xs uppercase tracking-wide text-ink-soft">
                <th className="px-4 py-3 font-medium">{t.code}</th>
                <th className="px-4 py-3 font-medium">{t.type}</th>
                <th className="px-4 py-3 font-medium">{t.value}</th>
                <th className="px-4 py-3 font-medium">{t.status}</th>
                <th className="px-4 py-3 font-medium">{t.usage}</th>
                <th className="px-4 py-3 font-medium">{t.dates}</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {discounts.map((d) => (
                <tr
                  key={d.id}
                  onClick={() => setFormTarget(d)}
                  className="cursor-pointer border-b border-line last:border-0 hover:bg-paper-raised"
                >
                  <td className="px-4 py-3">
                    {d.code ? (
                      <span className="font-medium text-ink">{d.code}</span>
                    ) : (
                      <span className="text-ink-soft">{t.automatic}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-ink-soft">{t[TYPE_LABEL[d.type]]}</td>
                  <td className="px-4 py-3 text-ink-soft">{discountValueLabel(d)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge value={displayStatus(d)} text={t[`status_${displayStatus(d)}`]} />
                  </td>
                  <td className="px-4 py-3 text-ink-soft">
                    {d.usageCount}
                    {d.usageLimit != null ? ` / ${d.usageLimit}` : ""}
                  </td>
                  <td className="px-4 py-3 text-ink-soft">{dateRangeLabel(d, t)}</td>
                  <td
                    className="whitespace-nowrap px-4 py-3 text-end"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {d.code && d.status !== "archived" && (
                      <Button size="sm" variant="ghost" onClick={() => setSharing(d)}>
                        {t.shareLink}
                      </Button>
                    )}
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
                      {t.delete}
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
        title={formTarget === "new" ? t.create : t.editTitle}
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

      {sharing && (
        <CouponLinkDialog
          discount={sharing}
          statusText={displayStatus(sharing) === "active" ? null : t[`status_${displayStatus(sharing)}`]}
          onClose={() => setSharing(null)}
        />
      )}

      <ConfirmDialog
        open={deleting !== null}
        title={deleting?.code ? fmt(t.archiveTitleCode, { code: deleting.code }) : t.archiveTitle}
        description={t.archiveDescription}
        confirmLabel={t.archiveConfirm}
        cancelLabel={t.cancel}
        busyLabel={t.working}
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
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
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
          value:
            type === "percentage" ? t.percentInvalid : t.amountInvalid,
        });
        return;
      }
      if (type === "percentage" && valueNum > 10000) {
        setFieldErrors({ value: t.percentTooHigh });
        return;
      }
    }

    let minSubtotalNum: number | null = null;
    if (minimumSubtotal.trim() !== "") {
      minSubtotalNum = majorToMinor(minimumSubtotal);
      if (!Number.isFinite(minSubtotalNum) || minSubtotalNum < 0) {
        setFieldErrors({ minimumSubtotal: t.amountInvalid });
        return;
      }
    }

    let usageLimitNum: number | null = null;
    if (usageLimit.trim() !== "") {
      usageLimitNum = Math.floor(Number(usageLimit));
      if (!Number.isFinite(usageLimitNum) || usageLimitNum < 1) {
        setFieldErrors({ usageLimit: t.limitInvalid });
        return;
      }
    }

    let perCustomerNum: number | null = null;
    if (perCustomerLimit.trim() !== "") {
      perCustomerNum = Math.floor(Number(perCustomerLimit));
      if (!Number.isFinite(perCustomerNum) || perCustomerNum < 1) {
        setFieldErrors({ perCustomerLimit: t.limitInvalid });
        return;
      }
    }

    if (productScope === "products" && productIds.length === 0) {
      setFieldErrors({ productRestrictions: t.productsRequired });
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
        toast.success(t.savedToast);
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
        toast.success(codeValue ? fmt(t.createdCodeToast, { code: codeValue }) : t.createdAutomaticToast);
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

      <Field
        label={t.code}
        error={fieldErrors.code}
        hint={t.codeHint}
      >
        {({ id, ...aria }) => (
          <div className="flex gap-2">
            <Input
              id={id}
              {...aria}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="SUMMER25"
              className={fieldErrors.code ? "border-danger focus-visible:ring-danger/30" : undefined}
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
            {(Object.keys(TYPE_LABEL) as DiscountType[]).map((opt) => (
              <option key={opt} value={opt}>
                {t[TYPE_LABEL[opt]]}
              </option>
            ))}
          </Select>
        )}
      </Field>

      {type === "percentage" && (
        <Field label={t.percentage} required error={fieldErrors.value} hint={t.percentageHint}>
          {({ id, ...aria }) => (
            <div className="relative">
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
          {t.cancel}
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? t.saving : isEdit ? t.save : t.create}
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
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
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

  if (products.loading) return <Spinner className="size-4" aria-label={t.loading} />;
  if (products.error) return <p className="text-sm text-danger">{getErrorMessage(products.error)}</p>;

  return (
    <div className="space-y-2 rounded-[var(--radius-card)] border border-line p-3">
      <div className="flex items-center justify-between gap-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t.filterProducts}
          className="max-w-xs"
        />
        <span className="whitespace-nowrap text-xs text-ink-soft">{fmt(t.selectedCount, { count: selected.length })}</span>
      </div>
      {filtered.length === 0 ? (
        <p className="text-sm text-ink-soft">
          {all.length === 0 ? t.noProducts : t.noMatch}
        </p>
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
