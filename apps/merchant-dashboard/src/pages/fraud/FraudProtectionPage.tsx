import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Check, Flag, Info, ShieldAlert, ShieldCheck, Trash2, X } from "lucide-react";
import { Alert, Button, Input, cn } from "@store-builder/ui";
import type { BlocklistEntry, FlaggedOrder, FraudRules } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useAsync } from "@/lib/useAsync";
import { useCursorList } from "@/lib/useCursorList";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useWorkspace } from "@/context/WorkspaceContext";
import { getErrorMessage } from "@/lib/errors";
import { formatDate, formatDateTime, formatMoney, humanize } from "@/lib/format";
import { fmt, useCommon, useT, type Messages } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { FilterTabs } from "@/components/FilterTabs";
import { LoadMore } from "@/components/LoadMore";
import { StatusBadge } from "@/components/StatusBadge";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Field, TextField } from "@/components/Field";
import { Textarea } from "@/components/Textarea";
import { useToast } from "@/components/Toast";

const PAGE_LIMIT = 25;

const STRINGS = {
  en: {
    title: "Fraud protection",
    description: "Catch suspicious cash-on-delivery orders before they cost you a shipment.",
    storefrontOnly: "These rules only apply to orders placed on your storefront",
    storefrontOnlyHint:
      "Orders you or your team create by hand in the dashboard are never checked and never blocked.",
    tabsLabel: "Fraud protection section",
    tabRules: "Rules",
    tabFlagged: "Flagged orders",
    tabBlocklist: "Blocklist",

    whenMatches: "When a rule matches",
    flag: "Flag it for review",
    flagHint: "The order is placed and shows up under Flagged orders, for you to approve or cancel.",
    block: "Block the order",
    blockHint: "The shopper sees an error and no order is created.",
    blockBlacklisted: "Block blocked numbers outright",
    blockBlacklistedHint:
      "Refuse orders from phones on your blocklist. With this off, those orders are only flagged.",
    ruleDuplicate: "Duplicate orders",
    ruleDuplicateHint: "The same customer orders the same item again within this many minutes.",
    ruleDuplicateUnit: "minutes (1–10080)",
    rulePhoneLimit: "Too many orders from one phone",
    rulePhoneLimitHint: "This many orders or more from a single phone in 24 hours.",
    rulePhoneLimitUnit: "orders / day (1–100)",
    ruleRejection: "Customers who often refuse delivery",
    ruleRejectionHint: "The customer has already rejected at least this many orders.",
    ruleRejectionUnit: "rejected orders (1–100)",
    enableRule: "Turn on: {label}",
    valueAria: "Value for {label}",
    errRange: "{label}: enter a whole number between {min} and {max}.",
    saveRules: "Save rules",
    savedToast: "Fraud rules saved.",

    flagDuplicateOrder: "Duplicate order",
    flagPhoneDailyLimit: "Over the daily phone limit",
    flagHighRejectionCustomer: "Often rejects orders",

    showResolved: "Also show orders already reviewed or cancelled",
    emptyFlagged: "No flagged orders",
    emptyFlaggedDesc:
      "When a storefront order trips one of your rules it lands here, with the reason, so you can decide before it ships.",
    colOrder: "Order",
    colCustomer: "Customer",
    colPhone: "Phone",
    colTotal: "Total",
    colFlags: "Why it was flagged",
    colDate: "Placed",
    cancelledState: "Cancelled",
    reviewedState: "Reviewed",
    approve: "Approve",
    cancelOrder: "Cancel order",
    approvedToast: "Order {order} approved.",
    cancelledToast: "Order {order} cancelled.",
    cancelTitle: "Cancel order {order}?",
    cancelDescription: "The order is cancelled for good. This can't be undone.",
    cancelReason: "Reason",
    cancelReasonPlaceholder: "e.g. Fake order",
    errCancelReason: "Say why you're cancelling — at least 2 characters.",

    addTitle: "Block a phone number",
    addDesc:
      "Blocking works on the number, so it covers a customer who has never ordered from you yet.",
    phone: "Phone",
    fullName: "Name (optional)",
    reason: "Reason",
    reasonPlaceholder: "e.g. Refused three deliveries",
    errPhone: "Enter a phone number.",
    errReason: "The reason has to be 2 to 300 characters.",
    adding: "Blocking…",
    addButton: "Block this number",
    addedToast: "Number added to the blocklist.",
    emptyBlocklist: "Nothing blocked yet",
    emptyBlocklistDesc: "Numbers you block show up here, with the reason and their order history.",
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
    title: "الحماية من النصب",
    description: "امسك طلبات الدفع عند الاستلام المشبوهة قبل ما تخسر فيها شحنة.",
    storefrontOnly: "القواعد دي بتتطبق على الطلبات اللي بتيجي من المتجر بس",
    storefrontOnlyHint:
      "الطلبات اللي بتعملها إنت أو فريقك بإيدكم من لوحة التحكم مش بتتفحص ولا بتتمنع أبداً.",
    tabsLabel: "قسم الحماية من النصب",
    tabRules: "القواعد",
    tabFlagged: "طلبات متعلّمة",
    tabBlocklist: "قايمة الحظر",

    whenMatches: "لما القاعدة تنطبق",
    flag: "علّمه للمراجعة",
    flagHint: "الطلب بيتسجّل ويظهر في الطلبات المتعلّمة، وإنت توافق عليه أو تلغيه.",
    block: "امنع الطلب",
    blockHint: "العميل هيشوف رسالة خطأ ومفيش طلب هيتسجّل.",
    blockBlacklisted: "امنع الأرقام المحظورة على طول",
    blockBlacklistedHint:
      "ارفض طلبات الأرقام اللي في قايمة الحظر. لو دي مقفولة، الطلبات دي هتتعلّم بس.",
    ruleDuplicate: "طلبات مكررة",
    ruleDuplicateHint: "نفس العميل يطلب نفس المنتج تاني خلال عدد الدقايق ده.",
    ruleDuplicateUnit: "دقيقة (1–10080)",
    rulePhoneLimit: "طلبات كتير من رقم واحد",
    rulePhoneLimitHint: "العدد ده من الطلبات أو أكتر من رقم واحد في 24 ساعة.",
    rulePhoneLimitUnit: "طلب / يوم (1–100)",
    ruleRejection: "عملاء بيرفضوا الاستلام كتير",
    ruleRejectionHint: "العميل رفض العدد ده من الطلبات أو أكتر قبل كده.",
    ruleRejectionUnit: "طلب مرفوض (1–100)",
    enableRule: "شغّل: {label}",
    valueAria: "قيمة {label}",
    errRange: "{label}: اكتب رقم صحيح من {min} لـ {max}.",
    saveRules: "احفظ القواعد",
    savedToast: "اتحفظت قواعد الحماية.",

    flagDuplicateOrder: "طلب مكرر",
    flagPhoneDailyLimit: "عدّى حد الرقم اليومي",
    flagHighRejectionCustomer: "بيرفض الطلبات كتير",

    showResolved: "اعرض كمان الطلبات اللي اتراجعت أو اتلغت",
    emptyFlagged: "مفيش طلبات متعلّمة",
    emptyFlaggedDesc:
      "لما طلب من المتجر يخالف قاعدة من قواعدك هينزل هنا بالسبب، عشان تقرّر قبل ما يتشحن.",
    colOrder: "الطلب",
    colCustomer: "العميل",
    colPhone: "الموبايل",
    colTotal: "الإجمالي",
    colFlags: "سبب التعليم",
    colDate: "اتعمل",
    cancelledState: "اتلغى",
    reviewedState: "اتراجع",
    approve: "وافق",
    cancelOrder: "الغي الطلب",
    approvedToast: "الطلب {order} اتوافق عليه.",
    cancelledToast: "الطلب {order} اتلغى.",
    cancelTitle: "تلغي الطلب {order}؟",
    cancelDescription: "الطلب هيتلغي خلاص ومش هينفع ترجع فيه.",
    cancelReason: "السبب",
    cancelReasonPlaceholder: "مثلاً: طلب وهمي",
    errCancelReason: "قول سبب الإلغاء — حرفين على الأقل.",

    addTitle: "احظر رقم موبايل",
    addDesc: "الحظر على الرقم نفسه، يعني بيشتغل حتى لو العميل ده لسه مطلبش منك خالص.",
    phone: "الموبايل",
    fullName: "الاسم (اختياري)",
    reason: "السبب",
    reasonPlaceholder: "مثلاً: رفض الاستلام 3 مرات",
    errPhone: "اكتب رقم الموبايل.",
    errReason: "السبب لازم يكون من حرفين لـ 300 حرف.",
    adding: "بنحظر…",
    addButton: "احظر الرقم ده",
    addedToast: "الرقم اتضاف لقايمة الحظر.",
    emptyBlocklist: "مفيش حاجة محظورة لسه",
    emptyBlocklistDesc: "الأرقام اللي تحظرها هتظهر هنا بالسبب وبتاريخ طلباتها.",
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

type Strings = (typeof STRINGS)["en"];
type TabKey = "rules" | "flagged" | "blocklist";

/** The flags the rule engine can attach. Anything else falls back to humanize. */
const FLAG_LABEL: Record<string, keyof Strings> = {
  duplicate_order: "flagDuplicateOrder",
  phone_daily_limit: "flagPhoneDailyLimit",
  high_rejection_customer: "flagHighRejectionCustomer",
};

function flagLabel(t: Strings, flag: string): string {
  const key = FLAG_LABEL[flag];
  return key ? t[key] : humanize(flag);
}

/**
 * A labelled checkbox row. `packages/ui` has no switch, and the dashboard's
 * other settings screens use a plain checkbox with `accent-primary`.
 */
function CheckRow({
  label,
  description,
  checked,
  onChange,
  hideLabel,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  hideLabel?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        className="mt-0.5 size-4 shrink-0 accent-primary"
        checked={checked}
        aria-label={hideLabel ? label : undefined}
        onChange={(e) => onChange(e.target.checked)}
      />
      {!hideLabel && (
        <span className="min-w-0">
          <span className="block text-sm font-medium text-ink">{label}</span>
          {description && <span className="block text-xs text-ink-soft">{description}</span>}
        </span>
      )}
    </label>
  );
}

export function FraudProtectionPage() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const [tab, setTab] = useState<TabKey>("rules");

  return (
    <div className="min-w-0 max-w-6xl">
      <PageHeader title={t.title} description={t.description} />

      <Alert variant="info" className="mb-6">
        <Info aria-hidden />
        <div>
          <p className="font-medium text-ink">{t.storefrontOnly}</p>
          <p className="text-sm text-ink-soft">{t.storefrontOnlyHint}</p>
        </div>
      </Alert>

      <FilterTabs
        className="mb-4"
        label={t.tabsLabel}
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "rules", label: t.tabRules },
          { value: "flagged", label: t.tabFlagged },
          { value: "blocklist", label: t.tabBlocklist },
        ]}
      />

      {/* Keyed on the workspace so switching store resets the drafts. */}
      {tab === "rules" && <RulesTab key={`rules-${workspaceId}`} />}
      {tab === "flagged" && <FlaggedTab key={`flagged-${workspaceId}`} />}
      {tab === "blocklist" && <BlocklistTab key={`block-${workspaceId}`} />}
    </div>
  );
}

// ------------------------------------------------------------------ Rules --

type NumericKey =
  | "duplicate_window_minutes"
  | "max_orders_per_phone_per_day"
  | "high_rejection_threshold";

/** Maximum the backend accepts, and the value a freshly-enabled rule starts at. */
const NUMERIC_RULES: ReadonlyArray<{ key: NumericKey; max: number; fallback: number }> = [
  { key: "duplicate_window_minutes", max: 10080, fallback: 30 },
  { key: "max_orders_per_phone_per_day", max: 100, fallback: 3 },
  { key: "high_rejection_threshold", max: 100, fallback: 2 },
];

const DEFAULT_RULES: Required<FraudRules> = {
  action: "flag",
  block_blacklisted: false,
  duplicate_window_minutes: null,
  max_orders_per_phone_per_day: null,
  high_rejection_threshold: null,
};

/** The stored blob, normalised. `WorkspaceSettings` types it as `unknown`. */
function readRules(raw: unknown): Required<FraudRules> {
  const r = (raw && typeof raw === "object" ? raw : {}) as FraudRules;
  return {
    action: r.action === "block" ? "block" : "flag",
    block_blacklisted: r.block_blacklisted === true,
    duplicate_window_minutes: r.duplicate_window_minutes ?? null,
    max_orders_per_phone_per_day: r.max_orders_per_phone_per_day ?? null,
    high_rejection_threshold: r.high_rejection_threshold ?? null,
  };
}

interface NumericDraft {
  enabled: boolean;
  /** Kept as typed text so a half-typed number is not thrown away. */
  value: string;
}

function toDrafts(rules: Required<FraudRules>): Record<NumericKey, NumericDraft> {
  return Object.fromEntries(
    NUMERIC_RULES.map(({ key, fallback }) => [
      key,
      { enabled: rules[key] !== null, value: String(rules[key] ?? fallback) },
    ])
  ) as Record<NumericKey, NumericDraft>;
}

function RulesTab() {
  const t = useT(STRINGS);
  const common = useCommon();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const { currentWorkspace, refresh } = useWorkspace();

  const stored = useMemo(
    () => readRules(currentWorkspace?.settings?.fraud_rules),
    [currentWorkspace?.settings?.fraud_rules]
  );
  const storedKey = JSON.stringify(stored);

  const [action, setAction] = useState<"flag" | "block">(stored.action);
  const [blockBlacklisted, setBlockBlacklisted] = useState(stored.block_blacklisted);
  const [drafts, setDrafts] = useState<Record<NumericKey, NumericDraft>>(() => toDrafts(stored));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-seed after the workspace loads or a save refreshes it.
  useEffect(() => {
    const next = readRules(currentWorkspace?.settings?.fraud_rules);
    setAction(next.action);
    setBlockBlacklisted(next.block_blacklisted);
    setDrafts(toDrafts(next));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentWorkspace?.id, storedKey]);

  const copy: Record<NumericKey, { label: string; hint: string; unit: string }> = {
    duplicate_window_minutes: {
      label: t.ruleDuplicate,
      hint: t.ruleDuplicateHint,
      unit: t.ruleDuplicateUnit,
    },
    max_orders_per_phone_per_day: {
      label: t.rulePhoneLimit,
      hint: t.rulePhoneLimitHint,
      unit: t.rulePhoneLimitUnit,
    },
    high_rejection_threshold: {
      label: t.ruleRejection,
      hint: t.ruleRejectionHint,
      unit: t.ruleRejectionUnit,
    },
  };

  /** The payload, or the first range message when a number is out of bounds. */
  function build(): Required<FraudRules> | string {
    const next: Required<FraudRules> = {
      ...DEFAULT_RULES,
      action,
      block_blacklisted: blockBlacklisted,
    };
    for (const { key, max } of NUMERIC_RULES) {
      const draft = drafts[key];
      if (!draft.enabled) continue;
      const n = Number(draft.value);
      if (!Number.isInteger(n) || n < 1 || n > max) {
        return fmt(t.errRange, { label: copy[key].label, min: 1, max });
      }
      next[key] = n;
    }
    return next;
  }

  const built = build();
  const dirty = typeof built === "string" || JSON.stringify(built) !== storedKey;

  async function save() {
    const next = build();
    if (typeof next === "string") {
      setError(next);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await apiClient.updateWorkspaceSettings(workspaceId, { fraud_rules: next });
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
      <div className="min-w-0 rounded-[var(--radius-card)] border border-line bg-paper-raised">
        <div className="border-b border-line px-4 py-3">
          <CheckRow
            label={t.blockBlacklisted}
            description={t.blockBlacklistedHint}
            checked={blockBlacklisted}
            onChange={setBlockBlacklisted}
          />
        </div>
        {NUMERIC_RULES.map(({ key, max }) => {
          const draft = drafts[key];
          const { label, hint, unit } = copy[key];
          return (
            <div
              key={key}
              className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3 last:border-0"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink">{label}</p>
                <p className="mt-0.5 text-xs text-ink-soft">{hint}</p>
              </div>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  min={1}
                  max={max}
                  step={1}
                  dir="ltr"
                  value={draft.value}
                  disabled={!draft.enabled}
                  onChange={(e) =>
                    setDrafts((prev) => ({ ...prev, [key]: { ...prev[key], value: e.target.value } }))
                  }
                  aria-label={fmt(t.valueAria, { label })}
                  className="tabular-nums h-8 w-24 px-2 text-sm"
                />
                <span className="text-xs text-ink-soft">{unit}</span>
                <CheckRow
                  hideLabel
                  label={fmt(t.enableRule, { label })}
                  checked={draft.enabled}
                  onChange={(next) =>
                    setDrafts((prev) => ({ ...prev, [key]: { ...prev[key], enabled: next } }))
                  }
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="space-y-4">
        <fieldset className="rounded-[var(--radius-card)] border border-line bg-paper-raised p-4">
          <legend className="px-1 text-sm font-medium text-ink">{t.whenMatches}</legend>
          <div className="mt-2 space-y-2">
            <ActionChoice
              checked={action === "flag"}
              onSelect={() => setAction("flag")}
              icon={<Flag className="size-3.5" aria-hidden />}
              title={t.flag}
              hint={t.flagHint}
              tone="primary"
            />
            <ActionChoice
              checked={action === "block"}
              onSelect={() => setAction("block")}
              icon={<ShieldAlert className="size-3.5" aria-hidden />}
              title={t.block}
              hint={t.blockHint}
              tone="danger"
            />
          </div>
        </fieldset>
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button className="w-full" onClick={save} disabled={saving || !dirty}>
          {saving ? common.saving : t.saveRules}
        </Button>
      </div>
    </div>
  );
}

function ActionChoice({
  checked,
  onSelect,
  icon,
  title,
  hint,
  tone,
}: {
  checked: boolean;
  onSelect: () => void;
  icon: ReactNode;
  title: string;
  hint: string;
  tone: "primary" | "danger";
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer gap-3 rounded-[0.5rem] border p-3 transition-colors",
        checked
          ? tone === "danger"
            ? "border-danger bg-danger-soft/40"
            : "border-primary bg-primary-soft/40"
          : "border-line"
      )}
    >
      <input
        type="radio"
        name="fraud-action"
        className="mt-0.5 size-4 shrink-0 accent-primary"
        checked={checked}
        onChange={onSelect}
      />
      <span className="min-w-0">
        <span className="flex items-center gap-1 text-sm font-medium text-ink">
          {icon}
          {title}
        </span>
        <span className="block text-xs text-ink-soft">{hint}</span>
      </span>
    </label>
  );
}

// ---------------------------------------------------------------- Flagged --

function FlaggedTab() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();

  const [includeResolved, setIncludeResolved] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<FlaggedOrder | null>(null);
  const [reason, setReason] = useState("");

  const list = useCursorList<FlaggedOrder>(
    async (before) => {
      const page = await apiClient.listFlaggedOrders(workspaceId, {
        limit: PAGE_LIMIT,
        includeResolved,
        ...(before ? { before } : {}),
      });
      return { items: page.orders, nextCursor: page.nextCursor };
    },
    [workspaceId, includeResolved]
  );

  /**
   * A row that is no longer flagged does not belong in the default list, so it
   * is dropped there and only patched in place when resolved rows are shown.
   */
  function settle(id: string, patch: Partial<FlaggedOrder>) {
    list.setItems((prev) =>
      includeResolved
        ? prev.map((row) => (row.id === id ? { ...row, ...patch } : row))
        : prev.filter((row) => row.id !== id)
    );
  }

  async function approve(order: FlaggedOrder) {
    setBusyId(order.id);
    try {
      await apiClient.approveFlaggedOrder(workspaceId, order.id);
      settle(order.id, { riskFlags: [] });
      toast.success(fmt(t.approvedToast, { order: order.orderNumber }));
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  async function confirmCancel() {
    if (!cancelling) return;
    const trimmed = reason.trim();
    // Thrown so ConfirmDialog shows it inline and stays open.
    if (trimmed.length < 2) throw new Error(t.errCancelReason);
    const order = cancelling;
    try {
      await apiClient.cancelOrder(workspaceId, order.id, trimmed);
    } catch (err) {
      throw new Error(getErrorMessage(err));
    }
    settle(order.id, { cancelled: true });
    toast.success(fmt(t.cancelledToast, { order: order.orderNumber }));
    setCancelling(null);
    setReason("");
  }

  return (
    <div className="space-y-3">
      <CheckRow label={t.showResolved} checked={includeResolved} onChange={setIncludeResolved} />

      <DataState loading={list.loading} error={list.error} onRetry={list.reload}>
        {list.items.length === 0 ? (
          <EmptyState icon={<ShieldCheck />} title={t.emptyFlagged} description={t.emptyFlaggedDesc} />
        ) : (
          <div className="min-w-0 overflow-x-auto rounded-[var(--radius-card)] border border-line bg-paper-raised">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-wide text-ink-soft">
                  <th className="px-4 py-3 text-start font-medium">{t.colOrder}</th>
                  <th className="px-4 py-3 text-start font-medium">{t.colCustomer}</th>
                  <th className="px-4 py-3 text-start font-medium">{t.colPhone}</th>
                  <th className="px-4 py-3 text-end font-medium">{t.colTotal}</th>
                  <th className="px-4 py-3 text-start font-medium">{t.colFlags}</th>
                  <th className="px-4 py-3 text-start font-medium">{t.colDate}</th>
                  <th className="px-4 py-3 text-end font-medium" />
                </tr>
              </thead>
              <tbody>
                {list.items.map((order) => {
                  const settled = order.cancelled || order.riskFlags.length === 0;
                  return (
                    <tr key={order.id} className="border-b border-line last:border-0 hover:bg-paper">
                      <td className="px-4 py-3 text-start font-medium">
                        <Link to={`/orders/${order.id}`} className="text-primary hover:underline">
                          <bdi dir="ltr">{order.orderNumber}</bdi>
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-start text-ink" dir="auto">
                        {order.customerName || "—"}
                      </td>
                      <td className="px-4 py-3 text-start text-ink-soft">
                        <bdi dir="ltr">{order.phone || "—"}</bdi>
                      </td>
                      <td className="tabular-nums whitespace-nowrap px-4 py-3 text-end text-ink">
                        <bdi dir="ltr">{formatMoney(order.totalAmount, order.currency)}</bdi>
                      </td>
                      <td className="px-4 py-3 text-start">
                        <div className="flex max-w-[260px] flex-wrap gap-1">
                          {order.riskFlags.length === 0
                            ? "—"
                            : order.riskFlags.map((flag) => (
                                <StatusBadge
                                  key={flag}
                                  value={flag}
                                  tone="warning"
                                  text={flagLabel(t, flag)}
                                />
                              ))}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-start text-xs text-ink-soft">
                        {formatDateTime(order.createdAt)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-end">
                        {settled ? (
                          <span className="text-xs text-ink-soft">
                            {order.cancelled ? t.cancelledState : t.reviewedState}
                          </span>
                        ) : (
                          <div className="flex justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-success"
                              disabled={busyId === order.id}
                              onClick={() => approve(order)}
                            >
                              <Check aria-hidden />
                              {t.approve}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-danger hover:bg-danger-soft"
                              disabled={busyId === order.id}
                              onClick={() => {
                                setReason("");
                                setCancelling(order);
                              }}
                            >
                              <X aria-hidden />
                              {t.cancelOrder}
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <LoadMore hasMore={list.hasMore} loading={list.loadingMore} onClick={list.loadMore} />
      </DataState>

      <ConfirmDialog
        open={cancelling !== null}
        title={cancelling ? fmt(t.cancelTitle, { order: cancelling.orderNumber }) : t.cancelOrder}
        description={t.cancelDescription}
        confirmLabel={t.cancelOrder}
        destructive
        onCancel={() => setCancelling(null)}
        onConfirm={confirmCancel}
      >
        <Field label={t.cancelReason} required>
          {({ id }) => (
            <Textarea
              id={id}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              dir="auto"
              placeholder={t.cancelReasonPlaceholder}
            />
          )}
        </Field>
      </ConfirmDialog>
    </div>
  );
}

// -------------------------------------------------------------- Blocklist --

function BlocklistTab() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const state = useAsync(() => apiClient.listBlocklist(workspaceId), [workspaceId]);
  const [removing, setRemoving] = useState<BlocklistEntry | null>(null);
  const entries = state.data ?? [];

  async function confirmRemove() {
    if (!removing) return;
    try {
      // Unblocking is a customer-level change, so it goes through the customer
      // endpoint — the fraud router only adds to the blocklist.
      await apiClient.setCustomerBlacklist(workspaceId, removing.customerId, {
        isBlacklisted: false,
      });
    } catch (err) {
      throw new Error(getErrorMessage(err));
    }
    toast.success(t.unblockedToast);
    setRemoving(null);
    state.refresh({ silent: true });
  }

  return (
    <div className="space-y-4">
      <BlockForm onBlocked={() => state.refresh({ silent: true })} />

      <DataState
        loading={state.loading && !state.data}
        error={state.error}
        onRetry={() => state.refresh()}
      >
        {entries.length === 0 ? (
          <EmptyState
            icon={<ShieldAlert />}
            title={t.emptyBlocklist}
            description={t.emptyBlocklistDesc}
          />
        ) : (
          <div className="min-w-0 overflow-x-auto rounded-[var(--radius-card)] border border-line bg-paper-raised">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-wide text-ink-soft">
                  <th className="px-4 py-3 text-start font-medium">{t.colPhone}</th>
                  <th className="px-4 py-3 text-start font-medium">{t.colCustomer}</th>
                  <th className="px-4 py-3 text-start font-medium">{t.colReason}</th>
                  <th className="px-4 py-3 text-end font-medium">{t.colOrders}</th>
                  <th className="px-4 py-3 text-end font-medium">{t.colRejected}</th>
                  <th className="px-4 py-3 text-start font-medium">{t.colBlocked}</th>
                  <th className="px-4 py-3 text-end font-medium" />
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr
                    key={entry.customerId}
                    className="border-b border-line last:border-0 hover:bg-paper"
                  >
                    <td className="px-4 py-3 text-start text-ink">
                      <bdi dir="ltr">{entry.phone || "—"}</bdi>
                    </td>
                    <td className="px-4 py-3 text-start text-ink" dir="auto">
                      {entry.fullName || "—"}
                    </td>
                    <td
                      className="max-w-[260px] truncate px-4 py-3 text-start text-ink-soft"
                      dir="auto"
                    >
                      {entry.reason || "—"}
                    </td>
                    <td className="tabular-nums px-4 py-3 text-end text-ink-soft">
                      {entry.totalOrders}
                    </td>
                    <td className="tabular-nums px-4 py-3 text-end text-ink-soft">
                      {entry.totalRejectedOrders}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-start text-xs text-ink-soft">
                      {formatDate(entry.blockedAt)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-end">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-danger hover:bg-danger-soft"
                        onClick={() => setRemoving(entry)}
                        aria-label={fmt(t.unblockTitle, {
                          value: entry.phone || entry.fullName || "",
                        })}
                      >
                        <Trash2 aria-hidden />
                        {t.unblock}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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

function BlockForm({ onBlocked }: { onBlocked: () => void }) {
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
    const trimmedReason = reason.trim();
    if (trimmedReason.length < 2 || trimmedReason.length > 300) next.reason = t.errReason;
    setErrors(next);
    if (next.phone || next.reason) return;

    setSaving(true);
    try {
      await apiClient.addToBlocklist(workspaceId, {
        phone: phone.trim(),
        reason: trimmedReason,
        ...(fullName.trim() ? { fullName: fullName.trim() } : {}),
      });
      toast.success(t.addedToast);
      setPhone("");
      setFullName("");
      setReason("");
      onBlocked();
    } catch (err) {
      setErrors({ form: getErrorMessage(err) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      className="space-y-3 rounded-[var(--radius-card)] border border-line bg-paper-raised p-4"
    >
      <div>
        <p className="text-sm font-medium text-ink">{t.addTitle}</p>
        <p className="text-xs text-ink-soft">{t.addDesc}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <TextField
          label={t.phone}
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          error={errors.phone}
          placeholder="01012345678"
          dir="ltr"
          inputMode="tel"
        />
        <TextField
          label={t.fullName}
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          dir="auto"
        />
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
