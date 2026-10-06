import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Download, Filter, MessageCircle, Phone, ShoppingBag, Trash2 } from "lucide-react";
import { Alert, Button, Card, cn } from "@store-builder/ui";
import {
  LOST_ORDER_REASONS,
  LOST_ORDER_RECOVERY_STATUSES,
  LOST_ORDER_TABS,
  apiFieldProblems,
  isInvalidCursorError,
  lostOrdersConvert,
  lostOrdersDelete,
  lostOrdersExport,
  lostOrdersList,
  lostOrdersStats,
  lostOrdersRevealPhone,
  lostOrdersSendWhatsapp,
  lostOrdersUpdate,
  type LostOrder,
  type LostOrderReason,
  type LostOrderRecoveryStatus,
  type LostOrderStats,
  type LostOrderTab,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useCursorList } from "@/lib/useCursorList";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatDateTime, formatMinorMoney, formatMoney } from "@/lib/format";
import { storeUrl } from "@/lib/storeAddress";
import { useT, fmt, type Messages } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { DataTable, type Column } from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { Field, TextField } from "@/components/Field";
import { FilterTabs } from "@/components/FilterTabs";
import { KpiCard } from "@/components/KpiCard";
import { LoadMore } from "@/components/LoadMore";
import { Modal } from "@/components/Modal";
import { Select } from "@/components/Select";
import { StatusBadge } from "@/components/StatusBadge";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";
import { useWorkspace } from "@/context/WorkspaceContext";
import { LostOrderProductFilter, LostOrdersBulkBar, useLostOrderSelection } from "./LostOrdersBulk";
import { LostOrderTiming } from "./LostOrderTiming";

/**
 * System role keys carrying orders.manage, which every action here needs
 * (the list itself only needs orders.view). The dashboard sees only the role
 * key, so a custom role with the permission doesn't get the buttons; one
 * without it that slips through gets the 403 toast.
 */
const MANAGE_ROLES: ReadonlySet<string> = new Set(["owner", "workspace_manager", "order_operator"]);

const STRINGS = {
  en: {
    title: "Lost orders",
    description: "Every checkout that did not become an order: left unfinished, refused by a rule, or never verified. Win them back or turn them into orders.",
    exportCsv: "Export",
    exporting: "Exporting…",
    exported: "{n} lost orders exported.",
    statLost: "Lost this month",
    statLine: "{lost} lost this month · {recovered} won back, {amount}",
    filtersToggle: "Filters",
    filtersCount: "Filters ({n})",
    range: "Period",
    range_today: "Today",
    range_7: "7 days",
    range_30: "30 days",
    statRate: "Lost per 100 visits",
    statRateNone: "No visits recorded yet",
    statRecovered: "Recovered this month",
    statRecoveredHint: "Orders won back: {n}",
    tabsLabel: "Lost orders by review state",
    tab_all: "All",
    tab_under_review: "Under review",
    tab_completed: "Completed",
    tab_recovered: "Recovered",
    filterReason: "Reason",
    anyReason: "Any reason",
    filterSource: "Source",
    anySource: "Store and funnels",
    source_store: "Store",
    source_funnel: "Funnel",
    cameFrom: "Came from {source}",
    cameFromTitle: "Medium: {medium} · Ad: {ad} · Landing page: {page}",
    from: "From",
    to: "To",
    colCustomer: "Customer",
    colReason: "Reason",
    colProducts: "Products",
    colTotal: "Total",
    colRecovery: "Recovery",
    colDate: "Last activity",
    colActions: "Actions",
    unnamed: "No name yet",
    reason_incomplete: "Left the checkout",
    reason_invalid_data: "Incorrect data",
    reason_integrity_check: "Failed the bot check",
    reason_otp_unverified: "Phone not verified",
    reason_outside_country: "Outside allowed countries",
    reason_vpn: "VPN or server address",
    reason_blocked: "Blocked customer",
    reason_limit_exceeded: "Over a limit",
    reason_payment_failed: "Payment failed",
    status_awaiting_otp: "Waiting for the code",
    status_in_progress: "Still at checkout",
    recovery_not_contacted: "Not contacted",
    recovery_contacted: "Contacted",
    recovery_recovered: "Recovered",
    recovery_lost: "Gave up",
    recoveryLabel: "Recovery status",
    whatsapp: "WhatsApp",
    call: "Call",
    convert: "Convert to order",
    remove: "Delete",
    markReviewed: "Mark completed",
    reopen: "Back to review",
    orderPlaced: "Order {order}",
    more: "+{n} more",
    whatsappMessage: "Hello {name}, you left your order unfinished. You can complete it here: {link}",
    whatsappSent: "Recovery message sent from your WhatsApp number.",
    whatsappFromStore: "Send the recovery message from your WhatsApp number",
    saved: "Saved.",
    emptyTitle: "No lost orders",
    emptyDescription: "Checkouts that are left unfinished or refused will show up here.",
    emptyFiltered: "Nothing matches these filters.",
    removeTitle: "Delete this lost order?",
    removeDescription: "It disappears from the list and its recovery link stops working.",
    removing: "Deleting…",
    cancel: "Cancel",
    removed: "Lost order deleted.",
    convertTitle: "Convert to an order",
    convertDescription: "An order is created from what the shopper typed. Complete or correct it first.",
    name: "Customer name",
    phone: "Phone number",
    governorate: "Governorate",
    city: "City",
    address: "Address",
    required: "Fill this in.",
    placeOrder: "Create order",
    placing: "Creating…",
    converted: "Order {order} created.",
  },
  ar: {
    title: "الأوردرات المفقودة",
    description: "كل أوردر ماكملش: اتساب في النص، أو اترفض بقاعدة، أو رقمه ما اتأكدش. رجّعه أو حوّله لأوردر.",
    exportCsv: "تصدير",
    exporting: "بنصدّر…",
    exported: "تم تصدير {n} طلب مفقود.",
    statLost: "المفقود هذا الشهر",
    statLine: "{lost} مفقود الشهر ده · رجّعت {recovered} بـ {amount}",
    filtersToggle: "الفلاتر",
    filtersCount: "الفلاتر ({n})",
    range: "الفترة",
    range_today: "النهارده",
    range_7: "٧ أيام",
    range_30: "٣٠ يوم",
    statRate: "المفقود لكل 100 زيارة",
    statRateNone: "لا توجد زيارات مسجلة بعد",
    statRecovered: "المسترجَع هذا الشهر",
    statRecoveredHint: "أوردرات تم استرجاعها: {n}",
    tabsLabel: "الأوردرات المفقودة حسب المراجعة",
    tab_all: "الكل",
    tab_under_review: "تحت المراجعة",
    tab_completed: "مكتملة",
    tab_recovered: "مسترجَعة",
    filterReason: "السبب",
    anyReason: "أي سبب",
    filterSource: "المصدر",
    anySource: "المتجر ومسارات البيع",
    source_store: "المتجر",
    source_funnel: "مسار بيع",
    cameFrom: "جه من {source}",
    cameFromTitle: "الوسيط: {medium} · الإعلان: {ad} · صفحة الوصول: {page}",
    from: "من",
    to: "إلى",
    colCustomer: "العميل",
    colReason: "السبب",
    colProducts: "المنتجات",
    colTotal: "الإجمالي",
    colRecovery: "الاسترجاع",
    colDate: "آخر نشاط",
    colActions: "إجراءات",
    unnamed: "بدون اسم بعد",
    reason_incomplete: "ترك صفحة الطلب",
    reason_invalid_data: "بيانات غير صحيحة",
    reason_integrity_check: "فشل فحص البوتات",
    reason_otp_unverified: "الرقم لم يُؤكَّد",
    reason_outside_country: "خارج الدول المسموح بها",
    reason_vpn: "عنوان VPN أو سيرفر",
    reason_blocked: "عميل محظور",
    reason_limit_exceeded: "تجاوز حدًّا",
    reason_payment_failed: "فشل الدفع",
    status_awaiting_otp: "بانتظار الكود",
    status_in_progress: "ما زال في صفحة الطلب",
    recovery_not_contacted: "لم يتم التواصل",
    recovery_contacted: "تم التواصل",
    recovery_recovered: "تم الاسترجاع",
    recovery_lost: "لن يكمل",
    recoveryLabel: "حالة الاسترجاع",
    whatsapp: "واتساب",
    call: "اتصال",
    convert: "تحويل إلى أوردر",
    remove: "حذف",
    markReviewed: "تمت المراجعة",
    reopen: "إعادة للمراجعة",
    orderPlaced: "الأوردر {order}",
    more: "+{n} أخرى",
    whatsappMessage: "أهلًا {name}، طلبك لسه ما اكتملش. تقدر تكمّله من هنا: {link}",
    whatsappSent: "اتبعتت رسالة الاسترجاع من رقم واتساب بتاعك.",
    whatsappFromStore: "ابعت رسالة الاسترجاع من رقم واتساب بتاعك",
    saved: "اتحفظ.",
    emptyTitle: "لا توجد طلبات مفقودة",
    emptyDescription: "الطلبات التي تُترك دون إتمام أو تُرفض ستظهر هنا.",
    emptyFiltered: "لا توجد نتائج بهذه التصفية.",
    removeTitle: "حذف هذا الطلب المفقود؟",
    removeDescription: "سيختفي من القائمة ويتوقف رابط الاسترجاع الخاص به.",
    removing: "بنمسح…",
    cancel: "إلغاء",
    removed: "تم حذف الطلب المفقود.",
    convertTitle: "تحويل إلى أوردر",
    convertDescription: "يُنشأ أوردر مما كتبه المشتري. أكمل البيانات أو صحّحها أولًا.",
    name: "اسم العميل",
    phone: "رقم الهاتف",
    governorate: "المحافظة",
    city: "المدينة",
    address: "العنوان",
    required: "املأ هذا الحقل.",
    placeOrder: "إنشاء الأوردر",
    placing: "بنعمله…",
    converted: "تم إنشاء الأوردر {order}.",
  },
} satisfies Messages;

const RECOVERY_TONE: Record<LostOrderRecoveryStatus, "neutral" | "info" | "success" | "warning"> = {
  not_contacted: "warning",
  contacted: "info",
  recovered: "success",
  lost: "neutral",
};

function isTab(value: unknown): value is LostOrderTab {
  return typeof value === "string" && (LOST_ORDER_TABS as readonly string[]).includes(value);
}

/** Digits with the country code, for a wa.me link. Egyptian local numbers get 20. */
const reachable = (phone: string | null | undefined) => Boolean(phone && (/\d{6,}/.test(phone) || isMasked(phone)));
/** Phones are masked for roles without customers.reveal_sensitive; the row actions ask for the number (audited). */
const isMasked = (phone: string | null | undefined) => Boolean(phone && phone.includes("*"));

function whatsappNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("00")) return digits.slice(2);
  if (digits.startsWith("0")) return `20${digits.slice(1)}`;
  return digits;
}

/**
 * /abandoned-carts — "Lost orders": every checkout that did not become an
 * order, with why, and the ways to win it back.
 */
export function LostOrdersPage() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const { currentWorkspace } = useWorkspace();
  const canManage = MANAGE_ROLES.has(currentWorkspace?.role ?? "");

  const [params, setParams] = useSearchParams();
  const rawTab = params.get("tab");
  const tab: LostOrderTab = isTab(rawTab) ? rawTab : "all";
  const [reason, setReason] = useState<"" | LostOrderReason>("");
  const [source, setSource] = useState<"" | "store" | "funnel">("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [productId, setProductId] = useState("");

  const filters = useMemo(
    () => ({
      tab,
      lostReason: reason || undefined,
      source: source || undefined,
      from: from ? new Date(`${from}T00:00:00`).toISOString() : undefined,
      to: to ? new Date(`${to}T23:59:59`).toISOString() : undefined,
      productId: productId || undefined,
    }),
    [tab, reason, source, from, to, productId]
  );
  const filtered = Boolean(reason || source || from || to || productId);
  const activeFilters = [reason, source, from || to, productId].filter(Boolean).length;
  // Phones: the five filters fold behind one button (re-audit N-18); wide screens always show them.
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Date shortcuts, in the device's own days (the date fields are the browser's mm/dd/yyyy otherwise).
  const setRange = (days: 0 | 7 | 30) => {
    const day = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - (days === 0 ? 0 : days - 1));
    setFrom(day(start));
    setTo(day(today));
  };

  const [abandonedAfter, setAbandonedAfter] = useState<number | null>(null);
  const list = useCursorList<LostOrder>(
    async (cursor) => {
      const page = await lostOrdersList(apiClient, workspaceId, { ...filters, before: cursor });
      setAbandonedAfter(page.abandonedAfterMinutes);
      return { items: page.sessions, nextCursor: page.nextCursor };
    },
    [workspaceId, filters],
    { isStaleCursor: (err) => isInvalidCursorError(err, "before") }
  );
  const stats = useAsync<LostOrderStats>(() => lostOrdersStats(apiClient, workspaceId), [workspaceId]);

  const [converting, setConverting] = useState<LostOrder | null>(null);
  const [removing, setRemoving] = useState<LostOrder | null>(null);
  const [exporting, setExporting] = useState(false);

  function replace(updated: LostOrder) {
    list.setItems((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  }

  async function update(session: LostOrder, payload: Parameters<typeof lostOrdersUpdate>[3]) {
    try {
      replace(await lostOrdersUpdate(apiClient, workspaceId, session.id, payload));
      toast.success(t.saved);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  function recoveryLink(session: LostOrder): string | null {
    if (!session.recoveryPath || !currentWorkspace?.slug) return null;
    return `${storeUrl(currentWorkspace.slug)}${session.recoveryPath}`;
  }

  function whatsappHref(session: LostOrder): string {
    const link = recoveryLink(session) ?? "";
    const text = fmt(t.whatsappMessage, { name: session.customerName ?? "", link });
    return `https://wa.me/${whatsappNumber(session.phone)}?text=${encodeURIComponent(text)}`;
  }

  // With the store's WhatsApp connected, the row's WhatsApp sends the recovery template from that number (§6.3).
  const storeWhatsapp = useAsync(
    () => apiClient.getWhatsappIntegration(workspaceId).then((i) => Boolean(i && "connected" in i && i.connected)).catch(() => false),
    [workspaceId]
  );
  const sendsFromStore = storeWhatsapp.data === true;

  async function sendFromStore(session: LostOrder) {
    try {
      const res = await lostOrdersSendWhatsapp(apiClient, workspaceId, session.id);
      replace({ ...session, recoveryStatus: res.recoveryStatus });
      toast.success(t.whatsappSent);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  /** WhatsApp or call a masked number: the server hands over the one number, and logs it. */
  async function reach(session: LostOrder, kind: "whatsapp" | "call") {
    // Opened now, while the click still counts as the shopper's gesture; pointed at WhatsApp once the number is in.
    const win = kind === "whatsapp" ? window.open("", "_blank") : null;
    try {
      const phone = await lostOrdersRevealPhone(apiClient, workspaceId, session.id);
      if (!phone) {
        win?.close();
        return;
      }
      if (kind === "call") {
        window.location.href = `tel:${phone}`;
        return;
      }
      if (win) win.location.href = whatsappHref({ ...session, phone });
      if (canManage && session.recoveryStatus === "not_contacted") void update(session, { recoveryStatus: "contacted" });
    } catch (err) {
      win?.close();
      toast.error(errorMessage(err));
    }
  }

  async function runExport() {
    setExporting(true);
    try {
      const { csv, count, filename } = await lostOrdersExport(apiClient, workspaceId, filters);
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(fmt(t.exported, { n: count }));
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setExporting(false);
    }
  }

  async function confirmRemove() {
    if (!removing) return;
    try {
      await lostOrdersDelete(apiClient, workspaceId, removing.id);
    } catch (err) {
      throw new Error(errorMessage(err));
    }
    const id = removing.id;
    list.setItems((prev) => prev.filter((s) => s.id !== id));
    toast.success(t.removed);
    setRemoving(null);
    void stats.refresh({ silent: true });
  }

  const selection = useLostOrderSelection(list.items);
  const columns: Column<LostOrder>[] = [
    {
      key: "customer",
      header: t.colCustomer,
      cell: (s) => (
        <div className="min-w-0">
          <div className="font-medium text-ink" dir="auto">
            {s.customerName || t.unnamed}
          </div>
          <bdi dir="ltr" className="text-xs text-ink-soft">
            {s.phone}
          </bdi>
          {s.source === "funnel" && <div className="text-xs text-ink-soft">{t.source_funnel}</div>}
          {s.trafficSource?.source && (
            <div
              className="truncate text-xs text-ink-soft"
              title={fmt(t.cameFromTitle, {
                medium: s.trafficSource.medium ?? "—",
                ad: s.trafficSource.adId ?? "—",
                page: s.trafficSource.landingPage ?? "—",
              })}
            >
              {fmt(t.cameFrom, { source: s.trafficSource.source })}
              {s.trafficSource.campaign && (
                <>
                  {" · "}
                  <bdi>{s.trafficSource.campaign}</bdi>
                </>
              )}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "reason",
      header: t.colReason,
      cell: (s) => (
        <div className="flex flex-col items-start gap-1">
          {s.lostReason && (
            <StatusBadge
              value={s.lostReason}
              tone={s.lostReason === "incomplete" ? "neutral" : "warning"}
              text={t[`reason_${s.lostReason}`]}
            />
          )}
          {s.status === "awaiting_otp" && <StatusBadge value="awaiting_otp" tone="info" text={t.status_awaiting_otp} />}
          {s.status === "in_progress" && <StatusBadge value="in_progress" tone="info" text={t.status_in_progress} />}
          {s.convertedOrder && (
            <Link to={`/orders/${s.convertedOrder.id}`} className="text-xs font-medium text-primary hover:underline">
              {fmt(t.orderPlaced, { order: `⁦${s.convertedOrder.orderNumber}⁩` })}
            </Link>
          )}
        </div>
      ),
    },
    {
      key: "products",
      header: t.colProducts,
      cell: (s) => (
        <div className="min-w-0 text-ink">
          {s.items.slice(0, 2).map((item, i) => (
            <div key={`${item.variantId}-${i}`} className="truncate" dir="auto">
              {item.productName} <span className="text-ink-soft">× {item.quantity}</span>
            </div>
          ))}
          {s.items.length > 2 && <div className="text-xs text-ink-soft">{fmt(t.more, { n: s.items.length - 2 })}</div>}
        </div>
      ),
    },
    {
      key: "total",
      header: t.colTotal,
      align: "end",
      cell: (s) => <span className="font-medium text-ink">{formatMoney(s.subtotalAmount, s.currency)}</span>,
    },
    {
      key: "recovery",
      header: t.colRecovery,
      cell: (s) =>
        canManage && s.status !== "converted" ? (
          <Select
            aria-label={t.recoveryLabel}
            value={s.recoveryStatus}
            className="h-9 w-auto min-w-36"
            onChange={(e) => void update(s, { recoveryStatus: e.target.value as LostOrderRecoveryStatus })}
          >
            {LOST_ORDER_RECOVERY_STATUSES.map((key) => (
              <option key={key} value={key}>
                {t[`recovery_${key}`]}
              </option>
            ))}
          </Select>
        ) : (
          <StatusBadge value={s.recoveryStatus} tone={RECOVERY_TONE[s.recoveryStatus]} text={t[`recovery_${s.recoveryStatus}`]} />
        ),
    },
    {
      key: "date",
      header: t.colDate,
      cell: (s) => <time dateTime={s.lastActivityAt} className="text-ink-soft">{formatDateTime(s.lastActivityAt)}</time>,
    },
    {
      key: "actions",
      header: <span className="sr-only">{t.colActions}</span>,
      align: "end",
      cell: (s) => (
        <div className="flex flex-wrap justify-end gap-1.5">
          {/* A lost order captured from a name alone has no number to reach. */}
          {reachable(s.phone) && (
            <>
          <a
            href={whatsappHref(s)}
            target="_blank"
            rel="noreferrer"
            title={sendsFromStore ? t.whatsappFromStore : t.whatsapp}
            aria-label={sendsFromStore ? t.whatsappFromStore : t.whatsapp}
            onClick={(e) => {
              if (sendsFromStore) {
                e.preventDefault();
                void sendFromStore(s);
                return;
              }
              if (isMasked(s.phone)) {
                e.preventDefault();
                void reach(s, "whatsapp");
                return;
              }
              if (canManage && s.recoveryStatus === "not_contacted") void update(s, { recoveryStatus: "contacted" });
            }}
            className="inline-flex size-9 items-center justify-center rounded-md border border-line text-ink hover:border-primary/50 hover:text-primary"
          >
            <MessageCircle className="size-4" aria-hidden />
          </a>
          <a
            href={`tel:${s.phone}`}
            onClick={(e) => {
              if (!isMasked(s.phone)) return;
              e.preventDefault();
              void reach(s, "call");
            }}
            title={t.call}
            aria-label={t.call}
            className="inline-flex size-9 items-center justify-center rounded-md border border-line text-ink hover:border-primary/50 hover:text-primary"
          >
            <Phone className="size-4" aria-hidden />
          </a>
            </>
          )}
          {canManage && s.status !== "converted" && (
            <>
              <Button variant="outline" size="sm" className="min-h-9" onClick={() => setConverting(s)}>
                <ShoppingBag className="size-4" aria-hidden />
                {t.convert}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="min-h-9"
                onClick={() => void update(s, { reviewStatus: s.reviewStatus === "completed" ? "under_review" : "completed" })}
              >
                {s.reviewStatus === "completed" ? t.reopen : t.markReviewed}
              </Button>
              <Button variant="outline" size="sm" className="min-h-9" title={t.remove} aria-label={t.remove} onClick={() => setRemoving(s)}>
                <Trash2 className="size-4" aria-hidden />
              </Button>
            </>
          )}
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
          <Button variant="outline" className="min-h-10" onClick={() => void runExport()} disabled={exporting}>
            <Download className="size-4" aria-hidden />
            {exporting ? t.exporting : t.exportCsv}
          </Button>
        }
      />

      {stats.data && (
        <p className="mb-3 text-sm text-ink-soft sm:hidden">
          {fmt(t.statLine, {
            lost: stats.data.lost,
            recovered: stats.data.recovered,
            amount: formatMinorMoney(stats.data.recoveredAmount, stats.data.currency),
          })}
        </p>
      )}
      {stats.data && (
        <div className="mb-4 hidden gap-3 sm:grid sm:grid-cols-3">
          <KpiCard label={t.statLost} value={String(stats.data.lost)} />
          <KpiCard
            label={t.statRate}
            value={stats.data.lostRate === null ? "—" : String(stats.data.lostRate)}
            hint={stats.data.lostRate === null ? t.statRateNone : undefined}
          />
          <KpiCard
            label={t.statRecovered}
            value={formatMinorMoney(stats.data.recoveredAmount, stats.data.currency)}
            hint={fmt(t.statRecoveredHint, { n: stats.data.recovered })}
          />
        </div>
      )}

      <FilterTabs
        label={t.tabsLabel}
        value={tab}
        tabs={LOST_ORDER_TABS.map((key) => ({ value: key, label: t[`tab_${key}`] }))}
        className="mb-3 max-w-full flex-nowrap overflow-x-auto"
        buttonClassName="min-h-11 shrink-0 whitespace-nowrap"
        onChange={(next) =>
          setParams(
            (prev) => {
              const out = new URLSearchParams(prev);
              if (next === "all") out.delete("tab");
              else out.set("tab", next);
              return out;
            },
            { replace: true }
          )
        }
      />

      <Button
        variant="outline"
        className="mb-3 min-h-11 gap-2 sm:hidden"
        aria-expanded={filtersOpen}
        aria-controls="lost-order-filters"
        onClick={() => setFiltersOpen((open) => !open)}
      >
        <Filter className="size-4" aria-hidden />
        {activeFilters > 0 ? fmt(t.filtersCount, { n: activeFilters }) : t.filtersToggle}
      </Button>
      <div id="lost-order-filters" className={cn("mb-4 grid gap-3 sm:grid sm:grid-cols-2 lg:grid-cols-5", !filtersOpen && "hidden")}>
        <div className="flex flex-wrap items-center gap-2 sm:col-span-2 lg:col-span-5" role="group" aria-label={t.range}>
          <span className="text-sm text-ink-soft">{t.range}</span>
          {([0, 7, 30] as const).map((days) => (
            <Button key={days} variant="outline" size="sm" className="min-h-9" onClick={() => setRange(days)}>
              {days === 0 ? t.range_today : days === 7 ? t.range_7 : t.range_30}
            </Button>
          ))}
        </div>
        <LostOrderProductFilter value={productId} onChange={setProductId} />
        <Field label={t.filterReason}>
          {(props) => (
            <Select {...props} value={reason} onChange={(e) => setReason(e.target.value as "" | LostOrderReason)}>
              <option value="">{t.anyReason}</option>
              {LOST_ORDER_REASONS.map((key) => (
                <option key={key} value={key}>
                  {t[`reason_${key}`]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={t.filterSource}>
          {(props) => (
            <Select {...props} value={source} onChange={(e) => setSource(e.target.value as "" | "store" | "funnel")}>
              <option value="">{t.anySource}</option>
              <option value="store">{t.source_store}</option>
              <option value="funnel">{t.source_funnel}</option>
            </Select>
          )}
        </Field>
        <TextField label={t.from} type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
        <TextField label={t.to} type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
      </div>

      <LostOrdersBulkBar
        selection={selection}
        onDone={() => {
          list.reload();
          void stats.refresh({ silent: true });
        }}
      />
      <DataState loading={list.loading} error={list.items.length ? null : list.error} onRetry={list.reload}>
        <Card className="p-0">
          <DataTable
            columns={[selection.column, ...columns]}
            rows={list.items}
            rowKey={(s) => s.id}
            minWidth="68rem"
            empty={
              filtered || tab !== "all" ? (
                <EmptyState title={t.emptyFiltered} />
              ) : (
                <EmptyState icon={<ShoppingBag className="size-6" aria-hidden />} title={t.emptyTitle} description={t.emptyDescription} />
              )
            }
          />
        </Card>
        <LoadMore hasMore={list.hasMore} loading={list.loadingMore} onClick={list.loadMore} />
        {abandonedAfter !== null && (
          <LostOrderTiming
            minutes={abandonedAfter}
            onSaved={() => {
              list.reload();
              void stats.refresh({ silent: true });
            }}
          />
        )}
      </DataState>

      <ConvertModal
        session={converting}
        onClose={() => setConverting(null)}
        onConverted={(updated, orderNumber) => {
          replace(updated);
          setConverting(null);
          toast.success(fmt(t.converted, { order: `⁦${orderNumber}⁩` }));
          void stats.refresh({ silent: true });
        }}
      />
      <ConfirmDialog
        open={removing !== null}
        title={t.removeTitle}
        description={t.removeDescription}
        confirmLabel={t.remove}
        busyLabel={t.removing}
        cancelLabel={t.cancel}
        destructive
        onCancel={() => setRemoving(null)}
        onConfirm={confirmRemove}
      />
    </div>
  );
}

function ConvertModal({
  session,
  onClose,
  onConverted,
}: {
  session: LostOrder | null;
  onClose: () => void;
  onConverted: (session: LostOrder, orderNumber: string) => void;
}) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const errorMessage = useErrorMessage();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [province, setProvince] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [showErrors, setShowErrors] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!session) return;
    setName(session.customerName ?? "");
    setPhone(session.phone ?? "");
    setProvince(session.shippingAddress?.province ?? "");
    setCity(session.shippingAddress?.city ?? "");
    setAddress(session.shippingAddress?.addressLine ?? "");
    setShowErrors(false);
    setError(null);
  }, [session]);

  if (!session) return null;
  const missing = !name.trim() || !phone.trim() || !city.trim() || !address.trim();

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!session) return;
    if (missing) {
      setShowErrors(true);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await lostOrdersConvert(apiClient, workspaceId, session.id, {
        contact: { fullName: name.trim(), phone: phone.trim() },
        shippingAddress: {
          country: session.shippingAddress?.country ?? "EG",
          ...(province.trim() ? { province: province.trim() } : {}),
          city: city.trim(),
          addressLine: address.trim(),
        },
      });
      onConverted(result.session, result.order.orderNumber);
    } catch (err) {
      setError(apiFieldProblems(err)[0]?.message ?? errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const need = (value: string) => (showErrors && !value.trim() ? t.required : undefined);

  return (
    <Modal open onClose={onClose} title={t.convertTitle} description={t.convertDescription}>
      <form onSubmit={submit} noValidate className="space-y-4">
        <ul className="space-y-1 rounded-md border border-line bg-paper p-3 text-sm">
          {session.items.map((item, i) => (
            <li key={`${item.variantId}-${i}`} className="flex justify-between gap-3">
              <span dir="auto">
                {item.productName} <span className="text-ink-soft">× {item.quantity}</span>
              </span>
              <span className="shrink-0">{formatMoney(item.lineTotalAmount, session.currency)}</span>
            </li>
          ))}
        </ul>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label={t.name} required dir="auto" value={name} onChange={(e) => setName(e.target.value)} error={need(name)} />
          <TextField label={t.phone} required dir="ltr" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} error={need(phone)} />
          <TextField label={t.governorate} dir="auto" value={province} onChange={(e) => setProvince(e.target.value)} />
          <TextField label={t.city} required dir="auto" value={city} onChange={(e) => setCity(e.target.value)} error={need(city)} />
        </div>
        <TextField label={t.address} required dir="auto" value={address} onChange={(e) => setAddress(e.target.value)} error={need(address)} />
        {error && <Alert variant="danger">{error}</Alert>}
        <div className="flex justify-end gap-3 pt-1">
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            {t.cancel}
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? t.placing : t.placeOrder}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
