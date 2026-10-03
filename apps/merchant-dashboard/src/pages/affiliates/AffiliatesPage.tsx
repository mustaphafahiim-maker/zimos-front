import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { HandCoins, Pencil, Plus, UsersRound } from "lucide-react";
import { Alert, Button, Card } from "@store-builder/ui";
import {
  ApiError,
  affiliatesCommissions,
  affiliatesCreate,
  affiliatesList,
  affiliatesRecordPayout,
  affiliatesUpdate,
  type Affiliate,
  type AffiliateCommission,
  type AffiliateCommissionType,
  type CommissionStatus,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { STOREFRONT_URL } from "@/lib/storefrontUrl";
import { formatDate, formatMoney, majorToMinor, minorToMajorInput } from "@/lib/format";
import { useT, fmt, useCommon, type Messages } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { DataTable, type Column } from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { Field, TextField } from "@/components/Field";
import { FilterTabs } from "@/components/FilterTabs";
import { KpiCard } from "@/components/KpiCard";
import { Modal } from "@/components/Modal";
import { Select } from "@/components/Select";
import { StatusBadge } from "@/components/StatusBadge";
import { CopyButton } from "@/components/CopyButton";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";

const STRINGS = {
  en: {
    title: "Affiliates",
    description: "Marketers who sell your products for a commission. A commission is earned when the order is delivered and cancelled if it comes back.",
    add: "Add affiliate",
    tabs: "Affiliates view",
    tabAffiliates: "Affiliates",
    tabCommissions: "Commissions",
    kpiPending: "Waiting for delivery",
    kpiApproved: "To pay",
    kpiPaid: "Paid",
    portal: "Affiliate portal link",
    portalHint: "Share this link with your affiliates: they sign in with their phone and see their links, orders and balance.",
    colAffiliate: "Affiliate",
    colRate: "Commission",
    colOrders: "Orders",
    colPending: "Pending",
    colDue: "To pay",
    colPaid: "Paid",
    perOrder: "{amount} per order",
    paused: "Paused",
    copyLink: "Copy link",
    pay: "Mark as paid",
    edit: "Edit",
    emptyTitle: "No affiliates yet",
    emptyDescription: "Add a marketer, give them their link, and every delivered order that came through it earns them a commission.",
    createTitle: "Add an affiliate",
    editTitle: "Edit affiliate",
    name: "Name",
    phone: "Phone",
    phoneHint: "They sign in to the portal with this number.",
    code: "Code",
    codeHint: "Appears in their links as ?ref=code. Letters, digits, - and _.",
    type: "Commission type",
    type_percent: "Percentage of the products' value",
    type_fixed: "Fixed amount per order",
    percentValue: "Percentage (%)",
    fixedValue: "Amount per order ({currency})",
    active: "Active",
    notes: "Note",
    saved: "Affiliate saved.",
    codeTaken: "Another affiliate already uses that code.",
    phoneTaken: "Another affiliate already uses that phone number.",
    invalidPhone: "Enter a valid phone number.",
    payTitle: "Pay {name} {amount}?",
    payDescription: "Record it after you have sent the money (Vodafone Cash, transfer…). Their approved commissions become paid.",
    payConfirm: "I paid them",
    paying: "Saving…",
    paidToast: "Payout of {amount} recorded.",
    colOrder: "Order",
    colDate: "Date",
    colBase: "Products' value",
    colAmount: "Commission",
    colStatus: "Status",
    status_pending: "Pending delivery",
    status_approved: "Approved",
    status_paid: "Paid",
    status_void: "Cancelled",
    statusFilter: "Status",
    anyStatus: "Any status",
    emptyCommissions: "No commissions yet.",
  },
  ar: {
    title: "المسوّقون بالعمولة",
    description: "مسوّقون يبيعون منتجاتك مقابل عمولة. تُستحق العمولة عند تسليم الطلب وتُلغى إذا رجع.",
    add: "إضافة مسوّق",
    tabs: "طريقة عرض المسوّقين",
    tabAffiliates: "المسوّقون",
    tabCommissions: "العمولات",
    kpiPending: "في انتظار التسليم",
    kpiApproved: "مستحق الدفع",
    kpiPaid: "مدفوع",
    portal: "رابط بوابة المسوّقين",
    portalHint: "شارك هذا الرابط مع المسوّقين: يدخلون برقم الهاتف ويرون روابطهم وطلباتهم ورصيدهم.",
    colAffiliate: "المسوّق",
    colRate: "العمولة",
    colOrders: "الطلبات",
    colPending: "معلّق",
    colDue: "مستحق",
    colPaid: "مدفوع",
    perOrder: "{amount} لكل طلب",
    paused: "متوقف",
    copyLink: "نسخ الرابط",
    pay: "تسجيل الدفع",
    edit: "تعديل",
    emptyTitle: "لا يوجد مسوّقون بعد",
    emptyDescription: "أضف مسوّقًا وأعطه رابطه، وكل طلب مُسلَّم جاء عن طريقه يكسبه عمولة.",
    createTitle: "إضافة مسوّق",
    editTitle: "تعديل المسوّق",
    name: "الاسم",
    phone: "الهاتف",
    phoneHint: "يدخل به إلى البوابة.",
    code: "الكود",
    codeHint: "يظهر في روابطه هكذا ?ref=code. حروف إنجليزية وأرقام و - و _.",
    type: "نوع العمولة",
    type_percent: "نسبة من قيمة المنتجات",
    type_fixed: "مبلغ ثابت لكل طلب",
    percentValue: "النسبة (%)",
    fixedValue: "المبلغ لكل طلب ({currency})",
    active: "نشط",
    notes: "ملاحظة",
    saved: "تم حفظ المسوّق.",
    codeTaken: "يوجد مسوّق آخر بنفس الكود.",
    phoneTaken: "يوجد مسوّق آخر بنفس رقم الهاتف.",
    invalidPhone: "اكتب رقم هاتف صحيح.",
    payTitle: "دفع {amount} إلى {name}؟",
    payDescription: "سجّلها بعد أن ترسل المبلغ (فودافون كاش، تحويل…). عمولاته المستحقة تصبح مدفوعة.",
    payConfirm: "دفعت له",
    paying: "جارٍ الحفظ…",
    paidToast: "تم تسجيل دفع {amount}.",
    colOrder: "الطلب",
    colDate: "التاريخ",
    colBase: "قيمة المنتجات",
    colAmount: "العمولة",
    colStatus: "الحالة",
    status_pending: "في انتظار التسليم",
    status_approved: "مستحقة",
    status_paid: "مدفوعة",
    status_void: "ملغاة",
    statusFilter: "الحالة",
    anyStatus: "كل الحالات",
    emptyCommissions: "لا توجد عمولات بعد.",
  },
} satisfies Messages;

const STATUS_TONE: Record<CommissionStatus, "neutral" | "info" | "success" | "danger"> = {
  pending: "neutral",
  approved: "info",
  paid: "success",
  void: "danger",
};

const sum = (affiliates: Affiliate[], key: "pending" | "approved" | "paid") =>
  affiliates.reduce((total, a) => total + Number(a.totals?.[key] ?? 0), 0);

/** Affiliates (SPEC §20.3): marketers, their commissions and the payouts recorded by hand. */
export function AffiliatesPage() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const list = useAsync(() => affiliatesList(apiClient, workspaceId), [workspaceId]);
  const affiliates = list.data?.affiliates ?? [];
  const currency = list.data?.currency ?? "EGP";
  const [tab, setTab] = useState<"affiliates" | "commissions">("affiliates");
  const [editing, setEditing] = useState<Affiliate | "new" | null>(null);
  const [paying, setPaying] = useState<Affiliate | null>(null);
  const storeBase = `${STOREFRONT_URL}/store/${workspaceId}`;

  const rate = (a: Affiliate) =>
    a.commissionType === "percent" ? `${a.commissionValue / 100}%` : fmt(t.perOrder, { amount: formatMoney(a.commissionValue, currency) });

  async function confirmPay() {
    if (!paying) return;
    try {
      const payout = await affiliatesRecordPayout(apiClient, workspaceId, paying.id);
      toast.success(fmt(t.paidToast, { amount: formatMoney(payout.amount, payout.currency) }));
    } catch (err) {
      throw new Error(errorMessage(err));
    }
    setPaying(null);
    void list.refresh({ silent: true });
  }

  const columns: Column<Affiliate>[] = [
    {
      key: "affiliate",
      header: t.colAffiliate,
      cell: (a) => (
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-medium text-ink">
            <bdi>{a.name}</bdi>
            {a.status === "paused" && <StatusBadge value="paused" tone="neutral" text={t.paused} />}
          </p>
          <p className="text-xs text-ink-soft">
            <bdi dir="ltr">+{a.phone}</bdi> · <bdi dir="ltr">?ref={a.code}</bdi>
          </p>
        </div>
      ),
    },
    { key: "rate", header: t.colRate, cell: (a) => <span className="text-ink">{rate(a)}</span> },
    { key: "orders", header: t.colOrders, align: "end", cell: (a) => <span className="tabular-nums">{a.totals?.orders ?? 0}</span> },
    { key: "pending", header: t.colPending, align: "end", cell: (a) => <span className="tabular-nums text-ink-soft">{formatMoney(a.totals?.pending ?? 0, currency)}</span> },
    { key: "due", header: t.colDue, align: "end", cell: (a) => <span className="tabular-nums font-medium text-ink">{formatMoney(a.totals?.approved ?? 0, currency)}</span> },
    { key: "paid", header: t.colPaid, align: "end", cell: (a) => <span className="tabular-nums text-ink-soft">{formatMoney(a.totals?.paid ?? 0, currency)}</span> },
    {
      key: "actions",
      header: <span className="sr-only">{t.edit}</span>,
      align: "end",
      cell: (a) => (
        <div className="flex flex-wrap justify-end gap-2">
          <CopyButton value={`${storeBase}?ref=${a.code}`} label={t.copyLink} />
          {Number(a.totals?.approved ?? 0) > 0 && (
            <Button size="sm" className="min-h-9" onClick={() => setPaying(a)}>
              <HandCoins className="size-4" aria-hidden />
              {t.pay}
            </Button>
          )}
          <Button size="sm" variant="outline" className="min-h-9" onClick={() => setEditing(a)}>
            <Pencil className="size-4" aria-hidden />
            {t.edit}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="max-w-6xl">
      <PageHeader
        title={t.title}
        description={t.description}
        actions={
          <Button onClick={() => setEditing("new")}>
            <Plus className="size-4" aria-hidden />
            {t.add}
          </Button>
        }
      />

      <DataState loading={list.loading} error={list.error} onRetry={() => void list.refresh()}>
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <KpiCard label={t.kpiPending} value={formatMoney(sum(affiliates, "pending"), currency)} />
          <KpiCard label={t.kpiApproved} value={formatMoney(sum(affiliates, "approved"), currency)} />
          <KpiCard label={t.kpiPaid} value={formatMoney(sum(affiliates, "paid"), currency)} />
        </div>

        <Card className="mb-4 flex-row flex-wrap items-center justify-between gap-3 p-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">{t.portal}</p>
            <p className="text-xs text-ink-soft">{t.portalHint}</p>
          </div>
          <CopyButton value={`${storeBase}/affiliate`} label={t.copyLink} />
        </Card>

        <FilterTabs
          className="mb-4"
          label={t.tabs}
          value={tab}
          onChange={setTab}
          tabs={[
            { value: "affiliates", label: t.tabAffiliates },
            { value: "commissions", label: t.tabCommissions },
          ]}
        />

        {tab === "affiliates" ? (
          <Card className="p-0">
            <DataTable
              columns={columns}
              rows={affiliates}
              rowKey={(a) => a.id}
              minWidth="60rem"
              empty={
                <EmptyState
                  icon={<UsersRound className="size-6" aria-hidden />}
                  title={t.emptyTitle}
                  description={t.emptyDescription}
                  action={<Button onClick={() => setEditing("new")}>{t.add}</Button>}
                />
              }
            />
          </Card>
        ) : (
          <CommissionsTab />
        )}
      </DataState>

      <AffiliateModal
        affiliate={editing}
        currency={currency}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          void list.refresh({ silent: true });
        }}
      />
      <ConfirmDialog
        open={paying !== null}
        title={paying ? fmt(t.payTitle, { name: paying.name, amount: formatMoney(paying.totals?.approved ?? 0, currency) }) : ""}
        description={t.payDescription}
        confirmLabel={t.payConfirm}
        busyLabel={t.paying}
        onCancel={() => setPaying(null)}
        onConfirm={confirmPay}
      />
    </div>
  );
}

function CommissionsTab() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const [status, setStatus] = useState<"" | CommissionStatus>("");
  const list = useAsync(() => affiliatesCommissions(apiClient, workspaceId, { status: status || undefined, limit: 200 }), [workspaceId, status]);

  const columns: Column<AffiliateCommission>[] = [
    {
      key: "order",
      header: t.colOrder,
      cell: (c) => (
        <Link to={`/orders/${c.orderId}`} className="font-medium text-ink hover:text-primary">
          <bdi dir="ltr">{c.orderNumber}</bdi>
        </Link>
      ),
    },
    { key: "affiliate", header: t.colAffiliate, cell: (c) => <bdi>{c.affiliateName}</bdi> },
    { key: "date", header: t.colDate, cell: (c) => <span className="text-ink-soft">{formatDate(c.orderedAt)}</span> },
    { key: "base", header: t.colBase, align: "end", cell: (c) => <span className="tabular-nums text-ink-soft">{formatMoney(c.baseAmount, c.currency)}</span> },
    { key: "amount", header: t.colAmount, align: "end", cell: (c) => <span className="tabular-nums font-medium">{formatMoney(c.amount, c.currency)}</span> },
    { key: "status", header: t.colStatus, cell: (c) => <StatusBadge value={c.status} tone={STATUS_TONE[c.status]} text={t[`status_${c.status}`]} /> },
  ];

  return (
    <div className="space-y-3">
      <Field label={t.statusFilter} labelHidden className="w-56">
        {(props) => (
          <Select {...props} value={status} onChange={(e) => setStatus(e.target.value as "" | CommissionStatus)}>
            <option value="">
              {t.statusFilter}: {t.anyStatus}
            </option>
            {(["pending", "approved", "paid", "void"] as const).map((key) => (
              <option key={key} value={key}>
                {t[`status_${key}`]}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <DataState loading={list.loading} error={list.error} onRetry={() => void list.refresh()}>
        <Card className="p-0">
          <DataTable columns={columns} rows={list.data ?? []} rowKey={(c) => c.id} minWidth="48rem" empty={<EmptyState title={t.emptyCommissions} />} />
        </Card>
      </DataState>
    </div>
  );
}

function AffiliateModal({
  affiliate,
  currency,
  onClose,
  onSaved,
}: {
  affiliate: Affiliate | "new" | null;
  currency: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useT(STRINGS);
  const common = useCommon();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const existing = affiliate && affiliate !== "new" ? affiliate : null;
  const [form, setForm] = useState({ name: "", phone: "", code: "", type: "percent" as AffiliateCommissionType, value: "10", active: true, notes: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (affiliate === null) return;
    setError(null);
    setForm(
      existing
        ? {
            name: existing.name,
            phone: `+${existing.phone}`,
            code: existing.code,
            type: existing.commissionType,
            value: existing.commissionType === "percent" ? String(existing.commissionValue / 100) : minorToMajorInput(existing.commissionValue),
            active: existing.status === "active",
            notes: existing.notes ?? "",
          }
        : { name: "", phone: "", code: "", type: "percent", value: "10", active: true, notes: "" }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [affiliate === null, existing?.id]);

  const commissionValue = form.type === "percent" ? Math.round(Number(form.value) * 100) : majorToMinor(form.value);
  const valid = form.name.trim().length >= 2 && form.phone.trim() && form.code.trim().length >= 2 && Number.isFinite(commissionValue) && commissionValue > 0;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      code: form.code.trim(),
      commissionType: form.type,
      commissionValue,
      status: form.active ? ("active" as const) : ("paused" as const),
      notes: form.notes.trim() || null,
    };
    try {
      if (existing) await affiliatesUpdate(apiClient, workspaceId, existing.id, payload);
      else await affiliatesCreate(apiClient, workspaceId, payload);
      toast.success(t.saved);
      onSaved();
    } catch (err) {
      const code = err instanceof ApiError ? err.code : undefined;
      setError(
        code === "AFFILIATE_CODE_TAKEN" ? t.codeTaken : code === "AFFILIATE_PHONE_TAKEN" ? t.phoneTaken : code === "INVALID_PHONE" ? t.invalidPhone : errorMessage(err)
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={affiliate !== null} onClose={onClose} title={existing ? t.editTitle : t.createTitle}>
      <form onSubmit={submit} className="space-y-4">
        {error && <Alert variant="danger">{error}</Alert>}
        <TextField label={t.name} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={200} />
        <TextField label={t.phone} hint={t.phoneHint} required type="tel" dir="ltr" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} maxLength={32} />
        <TextField
          label={t.code}
          hint={t.codeHint}
          required
          dir="ltr"
          value={form.code}
          onChange={(e) => setForm({ ...form, code: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "") })}
          maxLength={40}
        />
        <Field label={t.type}>
          {(props) => (
            <Select {...props} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as AffiliateCommissionType })}>
              <option value="percent">{t.type_percent}</option>
              <option value="fixed">{t.type_fixed}</option>
            </Select>
          )}
        </Field>
        <TextField
          label={form.type === "percent" ? t.percentValue : fmt(t.fixedValue, { currency })}
          required
          inputMode="decimal"
          dir="ltr"
          value={form.value}
          onChange={(e) => setForm({ ...form, value: e.target.value })}
        />
        <TextField label={t.notes} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} maxLength={500} />
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
          {t.active}
        </label>
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            {common.cancel}
          </Button>
          <Button type="submit" disabled={busy || !valid}>
            {busy ? common.saving : common.save}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
