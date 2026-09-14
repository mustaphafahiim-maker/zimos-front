import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Alert, Button, Input } from "@store-builder/ui";
import { Plus, Search, Trash2, UserRound } from "lucide-react";
import type { Customer, Order, PaymentMethod, Product, ShippingZone } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { ApiError, getErrorMessage, getFieldErrors } from "@/lib/errors";
import { formatMoney, variantLabel } from "@/lib/format";
import { useLocale, useT, fmt, type Messages } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { Field, TextField } from "@/components/Field";
import { Select } from "@/components/Select";
import { Textarea } from "@/components/Textarea";
import { useToast } from "@/components/Toast";
import { GOVERNORATES, regionLabel } from "@/pages/onboarding/data";
import { ltr, useEnumLabel } from "./orderLabels";
import {
  buildCreateOrderPayload,
  clearDraft,
  draftFromOrder,
  emptyDraft,
  loadDraft,
  newLineKey,
  normalizeEgPhone,
  saveDraft,
  validateDraft,
  type DraftErrors,
  type DraftLine,
  type OrderDraft,
} from "./newOrder";

const STRINGS = {
  en: {
    title: "New order",
    description: "Create a phone or WhatsApp order manually. Prices, stock, discounts and shipping are verified by the server.",
    orders: "Orders",
    customer: "Customer",
    searchCustomers: "Search existing customers by phone or name",
    noCustomerMatch: "No saved customer matches — fill in the details below to add a new one.",
    selectedCustomer: "Existing customer",
    clearCustomer: "New customer instead",
    ordersCount: "{n} orders",
    phone: "Phone",
    phoneHint: "Egyptian mobile, e.g. 01012345678",
    fullName: "Full name",
    address: "Shipping address",
    governorate: "Governorate",
    chooseGovernorate: "Choose governorate",
    city: "City / area",
    addressLine: "Street, building, floor, landmark",
    notes: "Notes",
    notesPlaceholder: "Delivery instructions or internal notes",
    items: "Items",
    addItem: "Add item",
    product: "Product",
    chooseProduct: "Choose product",
    variant: "Variant or offer",
    chooseVariant: "Choose variant / offer",
    offerPrefix: "Offer",
    quantity: "Qty",
    lineTotal: "Line total",
    removeLine: "Remove item",
    inStock: "{n} available",
    outOfStock: "Out of stock",
    overselling: "Overselling allowed",
    lowStock: "Only {n} available",
    noProducts: "No active products yet. Add a product in the catalog first.",
    shippingDiscount: "Shipping & discount",
    shippingEstimate: "Estimated shipping",
    shippingHint: "Estimated from your shipping zones for this governorate. The server calculates the final fee (free-shipping threshold and default rate included).",
    shippingUnknown: "Calculated by the server when the order is created",
    discountCode: "Discount code",
    discountHint: "Validated by the server on submit.",
    payment: "Payment method",
    summary: "Order summary",
    subtotal: "Subtotal",
    shipping: "Shipping",
    discount: "Discount",
    total: "Estimated total",
    serverNote: "Final totals are computed by the server.",
    create: "Create order",
    creating: "Creating…",
    draftSaved: "Draft saved in this tab",
    discardDraft: "Discard draft",
    created: "Order {order} created.",
    duplicated: "Prefilled from order {order}. Review and create.",
    loadFailed: "Couldn't load products.",
    phoneRequired: "Enter the customer's phone.",
    phoneInvalid: "Enter a valid Egyptian mobile (010, 011, 012 or 015 + 8 digits).",
    nameRequired: "Enter the customer's name.",
    governorateRequired: "Choose a governorate.",
    cityRequired: "Enter the city or area.",
    addressRequired: "Enter the street address.",
    itemsRequired: "Add at least one item.",
    lineVariantRequired: "Choose a variant or offer.",
    lineQuantityInvalid: "Quantity must be 1 or more.",
    fixErrors: "Please fix the highlighted fields.",
  },
  ar: {
    title: "طلب جديد",
    description: "أنشئ طلبًا يدويًا من مكالمة أو واتساب. الأسعار والمخزون والخصومات والشحن يتم التحقق منها على الخادم.",
    orders: "الطلبات",
    customer: "العميل",
    searchCustomers: "ابحث في العملاء الحاليين بالهاتف أو الاسم",
    noCustomerMatch: "لا يوجد عميل مطابق — أدخل البيانات بالأسفل لإضافة عميل جديد.",
    selectedCustomer: "عميل حالي",
    clearCustomer: "عميل جديد بدلًا من ذلك",
    ordersCount: "{n} طلبات",
    phone: "الهاتف",
    phoneHint: "رقم موبايل مصري، مثال 01012345678",
    fullName: "الاسم بالكامل",
    address: "عنوان الشحن",
    governorate: "المحافظة",
    chooseGovernorate: "اختر المحافظة",
    city: "المدينة / المنطقة",
    addressLine: "الشارع، العمارة، الدور، علامة مميزة",
    notes: "ملاحظات",
    notesPlaceholder: "تعليمات التوصيل أو ملاحظات داخلية",
    items: "المنتجات",
    addItem: "إضافة منتج",
    product: "المنتج",
    chooseProduct: "اختر المنتج",
    variant: "النوع أو العرض",
    chooseVariant: "اختر النوع / العرض",
    offerPrefix: "عرض",
    quantity: "الكمية",
    lineTotal: "إجمالي البند",
    removeLine: "حذف المنتج",
    inStock: "{n} متاح",
    outOfStock: "نفد المخزون",
    overselling: "البيع بدون مخزون مسموح",
    lowStock: "متاح {n} فقط",
    noProducts: "لا توجد منتجات نشطة بعد. أضف منتجًا في الكتالوج أولًا.",
    shippingDiscount: "الشحن والخصم",
    shippingEstimate: "الشحن المتوقع",
    shippingHint: "تقدير من مناطق الشحن الخاصة بك لهذه المحافظة. الخادم يحسب الرسوم النهائية (بما في ذلك حد الشحن المجاني والسعر الافتراضي).",
    shippingUnknown: "يحسبه الخادم عند إنشاء الطلب",
    discountCode: "كود الخصم",
    discountHint: "يتم التحقق منه على الخادم عند الإرسال.",
    payment: "طريقة الدفع",
    summary: "ملخص الطلب",
    subtotal: "المجموع الفرعي",
    shipping: "الشحن",
    discount: "الخصم",
    total: "الإجمالي المتوقع",
    serverNote: "الإجماليات النهائية يحسبها الخادم.",
    create: "إنشاء الطلب",
    creating: "جارٍ الإنشاء…",
    draftSaved: "تم حفظ المسودة في هذه النافذة",
    discardDraft: "تجاهل المسودة",
    created: "تم إنشاء الطلب {order}.",
    duplicated: "تم تعبئة البيانات من الطلب {order}. راجعها ثم أنشئ الطلب.",
    loadFailed: "تعذر تحميل المنتجات.",
    phoneRequired: "أدخل رقم هاتف العميل.",
    phoneInvalid: "أدخل رقم موبايل مصري صحيح (010 أو 011 أو 012 أو 015 + 8 أرقام).",
    nameRequired: "أدخل اسم العميل.",
    governorateRequired: "اختر المحافظة.",
    cityRequired: "أدخل المدينة أو المنطقة.",
    addressRequired: "أدخل العنوان.",
    itemsRequired: "أضف منتجًا واحدًا على الأقل.",
    lineVariantRequired: "اختر النوع أو العرض.",
    lineQuantityInvalid: "الكمية يجب أن تكون 1 أو أكثر.",
    fixErrors: "من فضلك صحح الحقول المحددة.",
  },
} satisfies Messages;

const PAYMENT_METHODS: PaymentMethod[] = ["cod", "card", "wallet", "bank_transfer"];

interface Picked {
  price: number;
  currency: string;
  available: number | null; // null = unlimited (overselling allowed)
}

/** Resolve a draft line to price + stock from the loaded catalog. */
function resolveLine(products: Product[], line: DraftLine): Picked | null {
  const product = products.find((p) => p.id === line.productId);
  if (!product) return null;
  const variants = product.variants ?? [];
  const availableOf = (variantId: string, per = 1) => {
    const v = variants.find((x) => x.id === variantId);
    if (!v) return 0;
    if (v.allowOverselling) return null;
    return Math.floor(Math.max(0, v.stockOnHand - v.reservedStock) / per);
  };
  if (line.offerId) {
    const offer = (product.offers ?? []).find((o) => o.id === line.offerId);
    if (!offer) return null;
    const avail = offer.lines.map((l) => availableOf(l.variantId, l.quantity));
    const bounded = avail.filter((a): a is number => a !== null);
    return {
      price: Number(offer.priceAmount ?? 0),
      currency: offer.currency,
      available: bounded.length ? Math.min(...bounded) : null,
    };
  }
  const v = variants.find((x) => x.id === line.variantId);
  if (!v) return null;
  return { price: Number(v.priceAmount), currency: v.currency, available: availableOf(v.id) };
}

/** Mirror of the server's cheapest-rate pick for flat/free/tier rates — display only. */
function estimateShipping(zones: ShippingZone[], governorate: string, subtotal: number, qty: number): number | null {
  if (!governorate) return null;
  const region = regionLabel(governorate);
  const zone = zones.find(
    (z) =>
      z.isActive &&
      z.countries.includes("EG") &&
      !z.excludedRegions.includes(region) &&
      (z.regions.length === 0 || z.regions.includes(region))
  );
  const rates = (zone?.rates ?? []).filter((r) => r.isActive);
  if (!zone || rates.length === 0) return null;
  const amounts = rates.map((r) => {
    const c = r.config as { amount?: number; tiers?: Array<Record<string, number>>; overflowAmount?: number };
    switch (r.rateType) {
      case "free":
        return 0;
      case "flat":
        return Number(c.amount ?? 0);
      case "quantity_based": {
        const tier = (c.tiers ?? []).find((t) => qty <= t.upToQuantity);
        return Number(tier ? tier.amount : c.overflowAmount ?? 0);
      }
      case "order_value_based": {
        const tier = [...(c.tiers ?? [])].sort((a, b) => b.minSubtotal - a.minSubtotal).find((t) => subtotal >= t.minSubtotal);
        return Number(tier ? tier.amount : 0);
      }
      default:
        return NaN; // weight-based needs variant weights — leave to the server
    }
  });
  if (amounts.some((a) => Number.isNaN(a))) return null;
  return Math.min(...amounts);
}

interface LocationState {
  duplicateFrom?: Order;
}

export function NewOrderPage() {
  const t = useT(STRINGS);
  const label = useEnumLabel();
  const { locale } = useLocale();
  const workspaceId = useWorkspaceId();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  const duplicateFrom = (location.state as LocationState | null)?.duplicateFrom;
  const [draft, setDraft] = useState<OrderDraft>(() => (duplicateFrom ? draftFromOrder(duplicateFrom) : loadDraft() ?? emptyDraft()));
  const [errors, setErrors] = useState<DraftErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [customerQuery, setCustomerQuery] = useState("");
  const idem = useRef<{ key: string; body: string } | null>(null);

  useEffect(() => {
    if (duplicateFrom) {
      toast.success(fmt(t.duplicated, { order: ltr(duplicateFrom.orderNumber) }));
      // Drop router state so a reload restores the autosaved draft instead of re-duplicating.
      navigate(location.pathname, { replace: true, state: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Autosave (debounced) to sessionStorage.
  useEffect(() => {
    const id = window.setTimeout(() => saveDraft(draft), 400);
    return () => window.clearTimeout(id);
  }, [draft]);

  const catalog = useAsync(async () => {
    const [products, zones, customers] = await Promise.all([
      apiClient.listProducts(workspaceId, { status: "active", limit: 200 }),
      apiClient.listShippingZones(workspaceId).catch(() => [] as ShippingZone[]),
      apiClient.listCustomers(workspaceId, { limit: 200 }).catch(() => ({ customers: [] as Customer[], nextCursor: null })),
    ]);
    return { products: products.products, zones, customers: customers.customers };
  }, [workspaceId]);

  const products = catalog.data?.products ?? [];
  const zones = catalog.data?.zones ?? [];
  const customers = catalog.data?.customers ?? [];

  const set = <K extends keyof OrderDraft>(key: K, value: OrderDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const setLine = (key: string, patch: Partial<DraftLine>) =>
    setDraft((d) => ({ ...d, lines: d.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)) }));

  const customerMatches = useMemo(() => {
    const q = customerQuery.trim().toLowerCase();
    if (q.length < 2) return [];
    const qPhone = normalizeEgPhone(q);
    return customers
      .filter(
        (c) =>
          (c.fullName ?? "").toLowerCase().includes(q) ||
          (qPhone.length >= 3 && ((c.phoneRaw ?? "").includes(qPhone) || c.phoneNormalized.includes(qPhone.replace(/^0/, ""))))
      )
      .slice(0, 8);
  }, [customerQuery, customers]);

  const selectedCustomer = draft.customerId ? customers.find((c) => c.id === draft.customerId) : undefined;

  function pickCustomer(c: Customer) {
    const phone = c.phoneRaw ? normalizeEgPhone(c.phoneRaw) : c.phoneNormalized;
    setDraft((d) => ({ ...d, customerId: c.id, phone, fullName: c.fullName ?? d.fullName }));
    setCustomerQuery("");
    // Fill the default address from the customer detail when available.
    apiClient
      .getCustomer(workspaceId, c.id)
      .then((full) => {
        const a = full.addresses?.find((x) => x.isDefault) ?? full.addresses?.[0];
        if (!a) return;
        const gov = GOVERNORATES.find((g) => regionLabel(g.code) === a.province || g.en === a.province || g.ar === a.province);
        setDraft((d) => ({
          ...d,
          governorate: d.governorate || (gov ? gov.code : ""),
          city: d.city || a.city,
          addressLine: d.addressLine || a.addressLine,
        }));
      })
      .catch(() => undefined);
  }

  const currency = useMemo(() => {
    for (const l of draft.lines) {
      const r = resolveLine(products, l);
      if (r) return r.currency;
    }
    return "EGP";
  }, [draft.lines, products]);

  const subtotal = draft.lines.reduce((sum, l) => {
    const r = resolveLine(products, l);
    return sum + (r ? r.price * (l.quantity || 0) : 0);
  }, 0);
  const totalQty = draft.lines.reduce((s, l) => s + (l.quantity || 0), 0);
  const shippingEstimate = estimateShipping(zones, draft.governorate, subtotal, totalQty);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const clientErrors = validateDraft(draft, t);
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length) {
      setFormError(t.fixErrors);
      return;
    }
    const payload = buildCreateOrderPayload(draft);
    const body = JSON.stringify(payload);
    // Same key for retries of the same payload (safe replay); a new key once the payload changes.
    if (!idem.current || idem.current.body !== body) idem.current = { key: crypto.randomUUID(), body };

    setSubmitting(true);
    try {
      const { order } = await apiClient.request<{ order: Order }>(`/workspaces/${workspaceId}/orders`, {
        method: "POST",
        body: payload,
        headers: { "Idempotency-Key": idem.current.key },
      });
      clearDraft();
      toast.success(fmt(t.created, { order: ltr(order.orderNumber) }));
      navigate(`/orders/${order.id}`);
    } catch (err) {
      const fields = getFieldErrors(err);
      if (err instanceof ApiError && err.code === "INVALID_PHONE") fields["contact.phone"] = err.message;
      if (err instanceof ApiError && err.status === 404 && /discount/i.test(err.message)) fields.discountCode = err.message;
      if (err instanceof ApiError && /DISCOUNT/i.test(err.code ?? "")) fields.discountCode = err.message;
      setErrors(fields);
      setFormError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  function addLine() {
    setDraft((d) => ({ ...d, lines: [...d.lines, { key: newLineKey(), productId: "", variantId: "", offerId: "", quantity: 1 }] }));
  }

  const hasDraftContent = draft.phone || draft.fullName || draft.lines.length > 0;

  return (
    <div className="max-w-6xl min-w-0">
      <PageHeader
        title={t.title}
        description={t.description}
        back={{ to: "/orders", label: t.orders }}
        actions={
          hasDraftContent ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                clearDraft();
                idem.current = null;
                setErrors({});
                setFormError(null);
                setDraft(emptyDraft());
              }}
            >
              {t.discardDraft}
            </Button>
          ) : undefined
        }
      />

      <form onSubmit={submit} noValidate className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-6">
          {formError && <Alert variant="danger">{formError}</Alert>}

          {/* Customer */}
          <section className="rounded-2xl border border-line bg-paper-raised p-5">
            <h2 className="mb-4 text-base font-semibold text-ink">{t.customer}</h2>
            {selectedCustomer ? (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-primary-soft px-3 py-2 text-sm">
                <span className="flex min-w-0 items-center gap-2 text-ink">
                  <UserRound className="size-4 text-primary" aria-hidden />
                  <span className="font-medium">{t.selectedCustomer}:</span>
                  <span className="truncate">{selectedCustomer.fullName || "—"}</span>
                  <span className="text-ink-muted">· {fmt(t.ordersCount, { n: selectedCustomer.totalOrders })}</span>
                </span>
                <Button type="button" variant="ghost" size="sm" onClick={() => set("customerId", null)}>
                  {t.clearCustomer}
                </Button>
              </div>
            ) : (
              <div className="relative mb-4">
                <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" aria-hidden />
                <Input
                  aria-label={t.searchCustomers}
                  placeholder={t.searchCustomers}
                  value={customerQuery}
                  onChange={(e) => setCustomerQuery(e.target.value)}
                  className="ps-9"
                />
                {customerQuery.trim().length >= 2 && (
                  <div className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-xl border border-line bg-paper-raised shadow-[var(--shadow-pop)]">
                    {customerMatches.length === 0 ? (
                      <p className="px-3 py-2 text-sm text-ink-soft">{t.noCustomerMatch}</p>
                    ) : (
                      customerMatches.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => pickCustomer(c)}
                          className="flex w-full cursor-pointer items-center justify-between gap-3 px-3 py-2 text-start text-sm hover:bg-primary-soft"
                        >
                          <span className="min-w-0 truncate text-ink">{c.fullName || "—"}</span>
                          <span dir="ltr" className="shrink-0 text-ink-muted">
                            {c.phoneRaw || c.phoneNormalized}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label={t.phone}
                required
                dir="ltr"
                inputMode="tel"
                autoComplete="off"
                value={draft.phone}
                hint={t.phoneHint}
                error={errors["contact.phone"]}
                onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value, customerId: null }))}
              />
              <TextField
                label={t.fullName}
                required
                value={draft.fullName}
                error={errors["contact.fullName"]}
                onChange={(e) => set("fullName", e.target.value)}
              />
            </div>
          </section>

          {/* Address */}
          <section className="rounded-2xl border border-line bg-paper-raised p-5">
            <h2 className="mb-4 text-base font-semibold text-ink">{t.address}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t.governorate} required error={errors["shippingAddress.province"]}>
                {({ id, ...aria }) => (
                  <Select id={id} {...aria} value={draft.governorate} onChange={(e) => set("governorate", e.target.value)}>
                    <option value="">{t.chooseGovernorate}</option>
                    {GOVERNORATES.map((g) => (
                      <option key={g.code} value={g.code}>
                        {locale === "ar" ? g.ar : g.en}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <TextField
                label={t.city}
                required
                value={draft.city}
                error={errors["shippingAddress.city"]}
                onChange={(e) => set("city", e.target.value)}
              />
            </div>
            <TextField
              className="mt-4"
              label={t.addressLine}
              required
              value={draft.addressLine}
              error={errors["shippingAddress.addressLine"]}
              onChange={(e) => set("addressLine", e.target.value)}
            />
            <Field label={t.notes} className="mt-4" error={errors.notes}>
              {({ id }) => (
                <Textarea id={id} value={draft.notes} placeholder={t.notesPlaceholder} onChange={(e) => set("notes", e.target.value)} />
              )}
            </Field>
          </section>

          {/* Items */}
          <section className="rounded-2xl border border-line bg-paper-raised p-5">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-ink">{t.items}</h2>
              <Button type="button" variant="outline" size="sm" onClick={addLine} disabled={products.length === 0}>
                <Plus aria-hidden /> {t.addItem}
              </Button>
            </div>
            {catalog.error ? (
              <Alert variant="danger">{t.loadFailed}</Alert>
            ) : !catalog.loading && products.length === 0 ? (
              <p className="text-sm text-ink-soft">{t.noProducts}</p>
            ) : null}
            {errors.items && <p className="mb-3 text-xs font-medium text-danger">{errors.items}</p>}
            <ul className="space-y-3">
              {draft.lines.map((line, i) => {
                const product = products.find((p) => p.id === line.productId);
                const resolved = resolveLine(products, line);
                const value = line.offerId ? `offer:${line.offerId}` : line.variantId ? `variant:${line.variantId}` : "";
                const over = resolved && resolved.available !== null && line.quantity > resolved.available;
                return (
                  <li key={line.key} className="rounded-xl border border-line p-3">
                    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_88px]">
                      <Field label={t.product}>
                        {({ id }) => (
                          <Select
                            id={id}
                            value={line.productId}
                            onChange={(e) => setLine(line.key, { productId: e.target.value, variantId: "", offerId: "" })}
                          >
                            <option value="">{t.chooseProduct}</option>
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </Select>
                        )}
                      </Field>
                      <Field label={t.variant} error={errors[`items.${i}.variantId`] ?? errors[`items.${i}.offerId`]}>
                        {({ id, ...aria }) => (
                          <Select
                            id={id}
                            {...aria}
                            value={value}
                            disabled={!product}
                            onChange={(e) => {
                              const [kind, refId] = e.target.value.split(":");
                              if (kind === "offer") {
                                const offer = product?.offers?.find((o) => o.id === refId);
                                setLine(line.key, { offerId: refId, variantId: offer?.lines[0]?.variantId ?? "" });
                              } else {
                                setLine(line.key, { offerId: "", variantId: refId ?? "" });
                              }
                            }}
                          >
                            <option value="">{t.chooseVariant}</option>
                            {(product?.variants ?? [])
                              .filter((v) => v.status === "active")
                              .map((v) => (
                                <option key={v.id} value={`variant:${v.id}`}>
                                  {variantLabel(v)} — {formatMoney(v.priceAmount, v.currency)}
                                </option>
                              ))}
                            {(product?.offers ?? [])
                              .filter((o) => o.status === "active" && o.lines.length > 0)
                              .map((o) => (
                                <option key={o.id} value={`offer:${o.id}`}>
                                  {t.offerPrefix}: {o.name} — {formatMoney(o.priceAmount ?? 0, o.currency)}
                                </option>
                              ))}
                          </Select>
                        )}
                      </Field>
                      <TextField
                        label={t.quantity}
                        type="number"
                        min={1}
                        inputMode="numeric"
                        dir="ltr"
                        value={String(line.quantity)}
                        error={errors[`items.${i}.quantity`]}
                        onChange={(e) => setLine(line.key, { quantity: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
                      />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span className={over || resolved?.available === 0 ? "text-danger" : "text-ink-soft"}>
                        {resolved
                          ? resolved.available === null
                            ? t.overselling
                            : resolved.available === 0
                              ? t.outOfStock
                              : over
                                ? fmt(t.lowStock, { n: resolved.available })
                                : fmt(t.inStock, { n: resolved.available })
                          : ""}
                      </span>
                      <span className="flex items-center gap-3">
                        <span className="text-ink-soft">{t.lineTotal}:</span>
                        <bdi className="tabular-nums font-medium text-ink">
                          {formatMoney(resolved ? resolved.price * (line.quantity || 0) : 0, resolved?.currency ?? currency)}
                        </bdi>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={t.removeLine}
                          onClick={() => setDraft((d) => ({ ...d, lines: d.lines.filter((l) => l.key !== line.key) }))}
                        >
                          <Trash2 aria-hidden />
                        </Button>
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* Shipping & discount & payment */}
          <section className="rounded-2xl border border-line bg-paper-raised p-5">
            <h2 className="mb-4 text-base font-semibold text-ink">{t.shippingDiscount}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <p className="text-sm font-medium text-ink">{t.shippingEstimate}</p>
                <p className="text-sm tabular-nums text-ink">
                  {shippingEstimate === null ? t.shippingUnknown : <bdi>{formatMoney(shippingEstimate, currency)}</bdi>}
                </p>
                <p className="text-xs text-ink-muted">{t.shippingHint}</p>
              </div>
              <TextField
                label={t.discountCode}
                dir="ltr"
                value={draft.discountCode}
                hint={t.discountHint}
                error={errors.discountCode}
                onChange={(e) => set("discountCode", e.target.value)}
              />
              <Field label={t.payment} error={errors.paymentMethod}>
                {({ id }) => (
                  <Select id={id} value={draft.paymentMethod} onChange={(e) => set("paymentMethod", e.target.value as PaymentMethod)}>
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m} value={m}>
                        {label(m)}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>
          </section>
        </div>

        {/* Summary */}
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <div className="rounded-2xl border border-line bg-paper-raised p-5">
            <h2 className="mb-4 text-base font-semibold text-ink">{t.summary}</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-ink-soft">{t.subtotal}</dt>
                <dd className="tabular-nums"><bdi>{formatMoney(subtotal, currency)}</bdi></dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-ink-soft">{t.shipping}</dt>
                <dd className="tabular-nums">{shippingEstimate === null ? "—" : <bdi>{formatMoney(shippingEstimate, currency)}</bdi>}</dd>
              </div>
              {draft.discountCode.trim() && (
                <div className="flex justify-between gap-2">
                  <dt className="text-ink-soft">{t.discount}</dt>
                  <dd dir="ltr" className="text-ink-muted">{draft.discountCode.trim()}</dd>
                </div>
              )}
              <div className="flex justify-between gap-2 border-t border-line pt-2 font-semibold text-ink">
                <dt>{t.total}</dt>
                <dd className="tabular-nums"><bdi>{formatMoney(subtotal + (shippingEstimate ?? 0), currency)}</bdi></dd>
              </div>
            </dl>
            <p className="mt-2 text-xs text-ink-muted">{t.serverNote}</p>
            <Button type="submit" className="mt-4 w-full" disabled={submitting}>
              {submitting ? t.creating : t.create}
            </Button>
            {hasDraftContent && <p className="mt-2 text-center text-xs text-ink-muted">{t.draftSaved}</p>}
          </div>
        </aside>
      </form>
    </div>
  );
}
