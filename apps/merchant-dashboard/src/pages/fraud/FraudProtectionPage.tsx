import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Alert, Button, Input, Tabs, TabsList, TabsTrigger, Toggle, cn, useAsync } from "@store-builder/ui";
import { Check, Flag, Info, ShieldAlert, Trash2, X } from "lucide-react";
import type { BlocklistEntry, FlaggedOrder, FraudRules } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useWorkspace } from "@/context/WorkspaceContext";
import { getErrorMessage } from "@/lib/errors";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { fmt, useCommon, useT, type Messages } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Field, TextField } from "@/components/Field";
import { Textarea } from "@/components/Textarea";
import { useToast } from "@/components/Toast";

const STRINGS = {
  en: {
    title: "Fraud protection",
    description: "Catch suspicious cash-on-delivery orders before they cost you a shipment.",
    storefrontOnly: "Rules apply to orders placed on your storefront only",
    storefrontOnlyHint: "Orders you create manually in the dashboard are never checked or blocked.",
    tabRules: "Rules",
    tabFlagged: "Flagged orders",
    tabBlocklist: "Blocklist",

    whenMatches: "When a rule matches",
    flag: "Flag for review",
    flagHint: "The order is placed and appears under Flagged orders so you can approve or cancel it.",
    block: "Block the order",
    blockHint: "The customer sees an error and the order is not created.",
    blockBlacklisted: "Block blacklisted customers",
    blockBlacklistedHint: "Reject orders from phones on your blocklist. When off, those orders are only flagged.",
    ruleDuplicate: "Duplicate orders",
    ruleDuplicateHint: "Same phone orders again within this many minutes.",
    ruleDuplicateUnit: "minutes (1–10080)",
    rulePhoneLimit: "Too many orders per phone",
    rulePhoneLimitHint: "More than this many orders from one phone in a day.",
    rulePhoneLimitUnit: "orders / day (1–100)",
    ruleRejection: "Customers who often reject",
    ruleRejectionHint: "Customer has rejected at least this many orders before.",
    ruleRejectionUnit: "rejected orders (1–100)",
    valueAria: "Value for {label}",
    errRange: "{label}: enter a whole number between {min} and {max}.",
    saveRules: "Save rules",
    savedToast: "Fraud rules saved.",

    flag_blacklisted_customer: "Blacklisted customer",
    flag_duplicate_order: "Duplicate order",
    flag_phone_daily_limit: "Daily phone limit",
    flag_high_rejection_customer: "Often rejects orders",
    showResolved: "Show resolved",
    emptyFlagged: "No flagged orders.",
    colOrder: "Order",
    colCustomer: "Customer",
    colPhone: "Phone",
    colTotal: "Total",
    colFlags: "Why flagged",
    colDate: "Date",
    cancelled: "Cancelled",
    reviewed: "Reviewed",
    approve: "Approve",
    cancelOrder: "Cancel order",
    approvedToast: "Order {order} approved.",
    cancelledToast: "Order {order} cancelled.",
    cancelTitle: "Cancel order {order}?",
    cancelDescription: "The order will be cancelled. This can't be undone.",
    cancelReason: "Reason",
    cancelReasonPlaceholder: "e.g. Fake order",
    loadMore: "Load more",
    loading: "Loading…",

    addTitle: "Block a phone number",
    phone: "Phone",
    fullName: "Name (optional)",
    reason: "Reason",
    reasonPlaceholder: "e.g. Refused 3 deliveries",
    errPhone: "Enter a phone number.",
    errReason: "Reason must be 2 to 300 characters.",
    adding: "Blocking…",
    addButton: "Block number",
    addedToast: "Number added to the blocklist.",
    emptyBlocklist: "Your blocklist is empty.",
    colReason: "Reason",
    colOrders: "Orders",
    colRejected: "Rejected",
    colBlocked: "Blocked on",
    unblock: "Unblock",
    unblockTitle: "Unblock {value}?",
    unblockDescription: "This customer will be able to order from your store again.",
    unblockedToast: "Customer unblocked.",
  },
  ar: {
    title: "الحماية من الاحتيال",
    description: "اكتشف طلبات الدفع عند الاستلام المشبوهة قبل ما تخسر فيها شحنة.",
    storefrontOnly: "القواعد بتتطبق على الطلبات اللي بتيجي من المتجر بس",
    storefrontOnlyHint: "الطلبات اللي بتعملها بإيدك من لوحة التحكم مش بتتفحص ولا بتتمنع.",
    tabRules: "القواعد",
    tabFlagged: "طلبات مشبوهة",
    tabBlocklist: "قائمة الحظر",

    whenMatches: "لما قاعدة تنطبق",
    flag: "علّم الطلب للمراجعة",
    flagHint: "الطلب بيتسجل ويظهر في الطلبات المشبوهة عشان توافق عليه أو تلغيه.",
    block: "امنع الطلب",
    blockHint: "العميل هيشوف رسالة خطأ والطلب مش هيتسجل.",
    blockBlacklisted: "امنع العملاء المحظورين",
    blockBlacklistedHint: "ارفض طلبات الأرقام اللي في قائمة الحظر. لو مقفولة، الطلبات دي بتتعلّم بس.",
    ruleDuplicate: "طلبات مكررة",
    ruleDuplicateHint: "نفس الرقم طلب تاني خلال العدد ده من الدقايق.",
    ruleDuplicateUnit: "دقيقة (1–10080)",
    rulePhoneLimit: "طلبات كتير من نفس الرقم",
    rulePhoneLimitHint: "أكتر من العدد ده من الطلبات من رقم واحد في اليوم.",
    rulePhoneLimitUnit: "طلب / يوم (1–100)",
    ruleRejection: "عملاء بيرفضوا كتير",
    ruleRejectionHint: "العميل رفض العدد ده من الطلبات أو أكتر قبل كده.",
    ruleRejectionUnit: "طلب مرفوض (1–100)",
    valueAria: "قيمة {label}",
    errRange: "{label}: اكتب رقم صحيح من {min} لـ {max}.",
    saveRules: "احفظ القواعد",
    savedToast: "اتحفظت قواعد الحماية.",

    flag_blacklisted_customer: "عميل محظور",
    flag_duplicate_order: "طلب مكرر",
    flag_phone_daily_limit: "تعدّى حد الرقم اليومي",
    flag_high_rejection_customer: "بيرفض الطلبات كتير",
    showResolved: "اعرض اللي اتراجع",
    emptyFlagged: "مفيش طلبات مشبوهة.",
    colOrder: "الطلب",
    colCustomer: "العميل",
    colPhone: "الموبايل",
    colTotal: "الإجمالي",
    colFlags: "سبب التعليم",
    colDate: "التاريخ",
    cancelled: "ملغي",
    reviewed: "اتراجع",
    approve: "وافق",
    cancelOrder: "إلغاء الطلب",
    approvedToast: "تمت الموافقة على الطلب {order}.",
    cancelledToast: "اتلغى الطلب {order}.",
    cancelTitle: "تلغي الطلب {order}؟",
    cancelDescription: "الطلب هيتلغي ومش هينفع ترجع فيه.",
    cancelReason: "السبب",
    cancelReasonPlaceholder: "مثلاً: طلب وهمي",
    loadMore: "اعرض أكتر",
    loading: "جاري التحميل…",

    addTitle: "احظر رقم موبايل",
    phone: "الموبايل",
    fullName: "الاسم (اختياري)",
    reason: "السبب",
    reasonPlaceholder: "مثلاً: رفض الاستلام 3 مرات",
    errPhone: "اكتب رقم الموبايل.",
    errReason: "السبب لازم يكون من 2 لـ 300 حرف.",
    adding: "جاري الحظر…",
    addButton: "احظر الرقم",
    addedToast: "الرقم اتضاف لقائمة الحظر.",
    emptyBlocklist: "قائمة الحظر فاضية.",
    colReason: "السبب",
    colOrders: "الطلبات",
    colRejected: "المرفوضة",
    colBlocked: "اتحظر في",
    unblock: "فك الحظر",
    unblockTitle: "تفك الحظر عن {value}؟",
    unblockDescription: "العميل ده هيقدر يطلب من متجرك تاني.",
    unblockedToast: "اتفك الحظر عن العميل.",
  },
} satisfies Messages;

type TabKey = "rules" | "flagged" | "blocklist";
type Strings = (typeof STRINGS)["en"];

const thBase = "px-4 py-3 font-medium text-start";
const PAGE_SIZE = 25;

function flagLabel(t: Strings, flag: string): string {
  const key = `flag_${flag}` as keyof Strings;
  return key in t ? t[key] : flag;
}

export function FraudProtectionPage() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const [tab, setTab] = useState<TabKey>("rules");

  return (
    <div className="min-w-0 max-w-6xl">
      <PageHeader title={t.title} description={t.description} />

      <Alert variant="info" className="mb-6 border-primary/30 bg-primary-soft/40">
        <Info />
        <div>
          <p className="font-medium text-ink">{t.storefrontOnly}</p>
          <p className="text-sm text-ink-soft">{t.storefrontOnlyHint}</p>
        </div>
      </Alert>

      <Tabs value={tab} onValueChange={(v) => setTab(String(v) as TabKey)} className="mb-4">
        <TabsList variant="line">
          <TabsTrigger value="rules">{t.tabRules}</TabsTrigger>
          <TabsTrigger value="flagged">{t.tabFlagged}</TabsTrigger>
          <TabsTrigger value="blocklist">{t.tabBlocklist}</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === "rules" && <RulesTab key={`rules-${workspaceId}`} />}
      {tab === "flagged" && <FlaggedTab key={`flagged-${workspaceId}`} />}
      {tab === "blocklist" && <BlocklistTab key={`block-${workspaceId}`} />}
    </div>
  );
}

// ----------------------------------------------------------------- Rules --

const DEFAULT_RULES: FraudRules = {
  action: "flag",
  block_blacklisted: false,
  duplicate_window_minutes: null,
  max_orders_per_phone_per_day: null,
  high_rejection_threshold: null,
};

type NumericKey = "duplicate_window_minutes" | "max_orders_per_phone_per_day" | "high_rejection_threshold";

interface NumericDraft {
  enabled: boolean;
  value: string;
}

const NUMERIC: { key: NumericKey; max: number; fallback: number }[] = [
  { key: "duplicate_window_minutes", max: 10080, fallback: 30 },
  { key: "max_orders_per_phone_per_day", max: 100, fallback: 3 },
  { key: "high_rejection_threshold", max: 100, fallback: 2 },
];

function readRules(raw: unknown): FraudRules {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<FraudRules>;
  return {
    action: r.action === "block" ? "block" : "flag",
    block_blacklisted: r.block_blacklisted === true,
    duplicate_window_minutes: r.duplicate_window_minutes ?? null,
    max_orders_per_phone_per_day: r.max_orders_per_phone_per_day ?? null,
    high_rejection_threshold: r.high_rejection_threshold ?? null,
  };
}

function RulesTab() {
  const t = useT(STRINGS);
  const c = useCommon();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const { currentWorkspace, refresh } = useWorkspace();
  const stored = useMemo(
    () => readRules(currentWorkspace?.settings?.fraud_rules ?? DEFAULT_RULES),
    [currentWorkspace?.settings?.fraud_rules]
  );

  const toDraft = (r: FraudRules) =>
    Object.fromEntries(
      NUMERIC.map(({ key, fallback }) => [key, { enabled: r[key] != null, value: String(r[key] ?? fallback) }])
    ) as Record<NumericKey, NumericDraft>;

  const [action, setAction] = useState<FraudRules["action"]>(stored.action);
  const [blockBlacklisted, setBlockBlacklisted] = useState(stored.block_blacklisted);
  const [nums, setNums] = useState<Record<NumericKey, NumericDraft>>(() => toDraft(stored));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAction(stored.action);
    setBlockBlacklisted(stored.block_blacklisted);
    setNums(toDraft(stored));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stored]);

  const copy: Record<NumericKey, { label: string; hint: string; unit: string }> = {
    duplicate_window_minutes: { label: t.ruleDuplicate, hint: t.ruleDuplicateHint, unit: t.ruleDuplicateUnit },
    max_orders_per_phone_per_day: { label: t.rulePhoneLimit, hint: t.rulePhoneLimitHint, unit: t.rulePhoneLimitUnit },
    high_rejection_threshold: { label: t.ruleRejection, hint: t.ruleRejectionHint, unit: t.ruleRejectionUnit },
  };

  function build(): FraudRules | string {
    const next: FraudRules = { ...DEFAULT_RULES, action, block_blacklisted: blockBlacklisted };
    for (const { key, max } of NUMERIC) {
      const d = nums[key];
      if (!d.enabled) {
        next[key] = null;
        continue;
      }
      const n = Number(d.value);
      if (!Number.isInteger(n) || n < 1 || n > max) return fmt(t.errRange, { label: copy[key].label, min: 1, max });
      next[key] = n;
    }
    return next;
  }

  const built = build();
  const dirty = typeof built === "string" || JSON.stringify(built) !== JSON.stringify(stored);

  async function save() {
    const next = build();
    if (typeof next === "string") {
      setError(next);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await apiClient.updateWorkspace(workspaceId, { settings: { fraud_rules: next } });
      await refresh();
      toast.success(t.savedToast);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0 rounded-2xl border border-line bg-paper-raised">
        <div className="border-b border-line px-4 py-3">
          <Toggle label={t.blockBlacklisted} description={t.blockBlacklistedHint} checked={blockBlacklisted} onChange={setBlockBlacklisted} />
        </div>
        {NUMERIC.map(({ key, max }) => {
          const d = nums[key];
          const { label, hint, unit } = copy[key];
          return (
            <div key={key} className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3 last:border-0">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink">{label}</p>
                <p className="mt-0.5 text-xs text-ink-soft">{hint}</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <Input
                    type="number"
                    min={1}
                    max={max}
                    step={1}
                    dir="ltr"
                    value={d.value}
                    disabled={!d.enabled}
                    onChange={(e) => setNums((p) => ({ ...p, [key]: { ...p[key], value: e.target.value } }))}
                    className="h-8 w-24 px-2 text-sm tabular-nums"
                    aria-label={fmt(t.valueAria, { label })}
                  />
                  <span className="text-xs text-ink-soft">{unit}</span>
                </div>
                <Toggle
                  label={label}
                  hideLabel
                  checked={d.enabled}
                  onChange={(next) => setNums((p) => ({ ...p, [key]: { ...p[key], enabled: next } }))}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="space-y-4">
        <div className="rounded-2xl border border-line bg-paper-raised p-4">
          <p className="text-sm font-medium text-ink">{t.whenMatches}</p>
          <div className="mt-3 space-y-2">
            <label className={cn("flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors", action === "flag" ? "border-primary bg-primary-soft/40" : "border-line")}>
              <input type="radio" name="fraud-action" checked={action === "flag"} onChange={() => setAction("flag")} className="mt-0.5" />
              <div>
                <p className="flex items-center gap-1 text-sm font-medium text-ink">
                  <Flag className="size-3.5" /> {t.flag}
                </p>
                <p className="text-xs text-ink-soft">{t.flagHint}</p>
              </div>
            </label>
            <label className={cn("flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors", action === "block" ? "border-danger bg-danger-soft/40" : "border-line")}>
              <input type="radio" name="fraud-action" checked={action === "block"} onChange={() => setAction("block")} className="mt-0.5" />
              <div>
                <p className="flex items-center gap-1 text-sm font-medium text-ink">
                  <ShieldAlert className="size-3.5" /> {t.block}
                </p>
                <p className="text-xs text-ink-soft">{t.blockHint}</p>
              </div>
            </label>
          </div>
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button className="w-full" onClick={save} disabled={saving || !dirty}>
          {saving ? c.saving : t.saveRules}
        </Button>
      </div>
    </div>
  );
}

// --------------------------------------------------------------- Flagged --

function FlaggedTab() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const [includeResolved, setIncludeResolved] = useState(false);
  const [rows, setRows] = useState<FlaggedOrder[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<FlaggedOrder | null>(null);
  const [reason, setReason] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    apiClient
      .listFlaggedOrders(workspaceId, { limit: PAGE_SIZE, includeResolved })
      .then((res) => {
        if (!alive) return;
        setRows(res.orders);
        setCursor(res.nextCursor);
      })
      .catch((err) => alive && setError(err))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [workspaceId, includeResolved, reloadKey]);

  async function loadMore() {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const res = await apiClient.listFlaggedOrders(workspaceId, { limit: PAGE_SIZE, before: cursor, includeResolved });
      setRows((prev) => [...prev, ...res.orders]);
      setCursor(res.nextCursor);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoadingMore(false);
    }
  }

  function markResolved(id: string, patch: Partial<FlaggedOrder>) {
    setRows((prev) =>
      includeResolved ? prev.map((x) => (x.id === id ? { ...x, ...patch } : x)) : prev.filter((x) => x.id !== id)
    );
  }

  async function approve(f: FlaggedOrder) {
    setBusy(f.id);
    try {
      await apiClient.approveFlaggedOrder(workspaceId, f.id);
      markResolved(f.id, { riskFlags: [] });
      toast.success(fmt(t.approvedToast, { order: f.orderNumber }));
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function confirmCancel() {
    if (!cancelling) return;
    const f = cancelling;
    await apiClient.cancelOrder(workspaceId, f.id, reason.trim());
    markResolved(f.id, { cancelled: true });
    toast.success(fmt(t.cancelledToast, { order: f.orderNumber }));
    setCancelling(null);
    setReason("");
  }

  return (
    <div className="space-y-3">
      <Toggle label={t.showResolved} checked={includeResolved} onChange={setIncludeResolved} className="max-w-xs" />
      <DataState loading={loading} error={error} empty={rows.length === 0} emptyMessage={t.emptyFlagged} onRetry={() => setReloadKey((k) => k + 1)}>
        <div className="overflow-x-auto rounded-2xl border border-line bg-paper-raised">
          <table className="w-full min-w-[880px] text-sm">
            <thead>
              <tr className="border-b border-line text-xs uppercase tracking-wide text-ink-soft">
                <th className={thBase}>{t.colOrder}</th>
                <th className={thBase}>{t.colCustomer}</th>
                <th className={thBase}>{t.colPhone}</th>
                <th className={cn(thBase, "text-end")}>{t.colTotal}</th>
                <th className={thBase}>{t.colFlags}</th>
                <th className={thBase}>{t.colDate}</th>
                <th className={thBase} />
              </tr>
            </thead>
            <tbody>
              {rows.map((f) => {
                const resolved = f.cancelled || f.riskFlags.length === 0;
                return (
                  <tr key={f.id} className="border-b border-line bg-paper last:border-0 hover:bg-paper-raised">
                    <td className="px-4 py-3 text-start font-medium">
                      <Link to={`/orders/${f.id}`} className="text-primary hover:underline" dir="ltr">
                        {f.orderNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-start text-ink" dir="auto">
                      {f.customerName || "—"}
                    </td>
                    <td className="px-4 py-3 text-start font-mono text-xs text-ink-soft">
                      <span dir="ltr">{f.phone || "—"}</span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-end tabular-nums text-ink">
                      <bdi>{formatMoney(f.totalAmount, f.currency)}</bdi>
                    </td>
                    <td className="px-4 py-3 text-start">
                      <div className="flex max-w-[260px] flex-wrap gap-1">
                        {f.riskFlags.map((r) => (
                          <span key={r} className="rounded-full bg-warning-soft px-2 py-0.5 text-[11px] font-medium text-warning">
                            {flagLabel(t, r)}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-start text-xs text-ink-soft">
                      <bdi>{formatDateTime(f.createdAt)}</bdi>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-end">
                      {resolved ? (
                        <span className="text-xs text-ink-soft">{f.cancelled ? t.cancelled : t.reviewed}</span>
                      ) : (
                        <>
                          <Button size="sm" variant="ghost" className="text-success" disabled={busy === f.id} onClick={() => approve(f)}>
                            <Check /> {t.approve}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-danger hover:bg-danger-soft"
                            disabled={busy === f.id}
                            onClick={() => {
                              setReason("");
                              setCancelling(f);
                            }}
                          >
                            <X /> {t.cancelOrder}
                          </Button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {cursor && (
          <div className="flex justify-center pt-2">
            <Button variant="outline" size="sm" onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? t.loading : t.loadMore}
            </Button>
          </div>
        )}
      </DataState>

      <ConfirmDialog
        open={cancelling !== null}
        title={cancelling ? fmt(t.cancelTitle, { order: cancelling.orderNumber }) : t.cancelOrder}
        description={t.cancelDescription}
        confirmLabel={t.cancelOrder}
        destructive
        confirmDisabled={reason.trim().length < 2}
        onCancel={() => setCancelling(null)}
        onConfirm={confirmCancel}
      >
        <Field label={t.cancelReason} required>
          {({ id }) => (
            <Textarea id={id} value={reason} onChange={(e) => setReason(e.target.value)} rows={2} dir="auto" placeholder={t.cancelReasonPlaceholder} />
          )}
        </Field>
      </ConfirmDialog>
    </div>
  );
}

// ------------------------------------------------------------- Blocklist --

function BlocklistTab() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const state = useAsync(() => apiClient.listBlocklist(workspaceId), [workspaceId]);
  const [removing, setRemoving] = useState<BlocklistEntry | null>(null);
  const entries = state.data ?? [];

  async function confirmRemove() {
    if (!removing) return;
    await apiClient.setCustomerBlacklist(workspaceId, removing.customerId, { isBlacklisted: false });
    toast.success(t.unblockedToast);
    setRemoving(null);
    state.refresh({ silent: true });
  }

  return (
    <div className="space-y-4">
      <BlockForm onDone={() => state.refresh({ silent: true })} />

      <DataState loading={state.loading} error={state.error} empty={entries.length === 0} emptyMessage={t.emptyBlocklist} onRetry={() => state.refresh()}>
        <div className="overflow-x-auto rounded-2xl border border-line bg-paper-raised">
          <table className="w-full min-w-[800px] text-sm">
            <thead>
              <tr className="border-b border-line text-xs uppercase tracking-wide text-ink-soft">
                <th className={thBase}>{t.colPhone}</th>
                <th className={thBase}>{t.colCustomer}</th>
                <th className={thBase}>{t.colReason}</th>
                <th className={cn(thBase, "text-end")}>{t.colOrders}</th>
                <th className={cn(thBase, "text-end")}>{t.colRejected}</th>
                <th className={thBase}>{t.colBlocked}</th>
                <th className={thBase} />
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.customerId} className="border-b border-line bg-paper last:border-0 hover:bg-paper-raised">
                  <td className="px-4 py-3 text-start font-mono text-xs text-ink">
                    <span dir="ltr">{e.phone || "—"}</span>
                  </td>
                  <td className="px-4 py-3 text-start text-ink" dir="auto">
                    {e.fullName || "—"}
                  </td>
                  <td className="max-w-[260px] truncate px-4 py-3 text-start text-ink-soft" dir="auto">
                    {e.reason || "—"}
                  </td>
                  <td className="px-4 py-3 text-end tabular-nums text-ink-soft">{e.totalOrders}</td>
                  <td className="px-4 py-3 text-end tabular-nums text-ink-soft">{e.totalRejectedOrders}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-start text-xs text-ink-soft">
                    <bdi>{formatDate(e.blockedAt)}</bdi>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-end">
                    <Button size="sm" variant="ghost" className="text-danger hover:bg-danger-soft" onClick={() => setRemoving(e)}>
                      <Trash2 /> {t.unblock}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DataState>

      <ConfirmDialog
        open={removing !== null}
        title={fmt(t.unblockTitle, { value: removing?.phone || removing?.fullName || "" })}
        description={t.unblockDescription}
        confirmLabel={t.unblock}
        destructive
        onCancel={() => setRemoving(null)}
        onConfirm={confirmRemove}
      />
    </div>
  );
}

function BlockForm({ onDone }: { onDone: () => void }) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const [phone, setPhone] = useState("");
  const [fullName, setFullName] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ phone?: string; reason?: string; form?: string }>({});

  async function submit(e: FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    if (!phone.trim()) next.phone = t.errPhone;
    const r = reason.trim();
    if (r.length < 2 || r.length > 300) next.reason = t.errReason;
    setErrors(next);
    if (next.phone || next.reason) return;
    setSaving(true);
    try {
      await apiClient.addToBlocklist(workspaceId, {
        phone: phone.trim(),
        reason: r,
        ...(fullName.trim() ? { fullName: fullName.trim() } : {}),
      });
      toast.success(t.addedToast);
      setPhone("");
      setFullName("");
      setReason("");
      onDone();
    } catch (err) {
      setErrors({ form: getErrorMessage(err) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl border border-line bg-paper-raised p-4">
      <p className="text-sm font-medium text-ink">{t.addTitle}</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <TextField
          label={t.phone}
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          error={errors.phone}
          placeholder="01012345678"
          className="font-mono"
          dir="ltr"
          inputMode="tel"
        />
        <TextField label={t.fullName} value={fullName} onChange={(e) => setFullName(e.target.value)} dir="auto" />
        <TextField
          label={t.reason}
          required
          value={reason}
          maxLength={300}
          onChange={(e) => setReason(e.target.value)}
          error={errors.reason}
          placeholder={t.reasonPlaceholder}
          dir="auto"
        />
      </div>
      {errors.form && <p className="text-sm text-danger">{errors.form}</p>}
      <div className="flex justify-end">
        <Button type="submit" disabled={saving}>
          {saving ? t.adding : t.addButton}
        </Button>
      </div>
    </form>
  );
}
