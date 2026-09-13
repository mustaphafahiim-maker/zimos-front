import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle, BellOff, Boxes, CheckCheck, Coins, Globe, PhoneCall, ShoppingCart, Target, TrendingDown, X } from "lucide-react";
import { cn } from "@store-builder/ui";
import { fmt, useT } from "@/i18n/LocaleContext";
import { mockApi } from "@/mock/api";
import { listInventoryItems } from "@/pages/inventory/inventoryAdapter";
import { useAsync } from "@/lib/useAsync";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useLocalStorage } from "@/lib/useLocalStorage";
import { computeBreakEven, computeMetrics, verdictFor } from "@/lib/adMetrics";
import { formatMoney, formatNumber, formatRelativeTime } from "@/lib/format";

const STRINGS = {
  en: {
    title: "Notifications",
    close: "Close notifications",
    markAll: "Mark all as read",
    all: "All",
    orders: "Orders",
    operations: "Operations",
    system: "System",
    empty: "You're all caught up",
    emptyHint: "New alerts about orders and operations will show up here.",
    unread: "Unread",
    flaggedTitle: "Order {order} needs review",
    flaggedBody: "{name} matched your fraud protection rules.",
    abandonedTitle: "Abandoned checkout",
    abandonedBody: "{name} left a cart worth {amount}.",
    confirmationTitle: "{count} orders awaiting confirmation",
    confirmationBody: "Call or WhatsApp customers to confirm their COD orders.",
    settlementTitle: "Settlement discrepancy",
    settlementBody: "{carrier} · {ref}: a difference of {amount}.",
    campaignTitle: "Campaign above break-even",
    campaignBody: "“{name}” costs more per delivered order than it earns. Consider pausing it.",
    stockTitle: "Low stock",
    stockBody: "{product} ({variant}): {available} left.",
    adAccountTitle: "Ad account needs reconnecting",
    adAccountBody: "{name} has stopped syncing spend data.",
    domainTitle: "Domain not verified",
    domainBody: "{host} is waiting for DNS verification.",
  },
  ar: {
    title: "الإشعارات",
    close: "إغلاق الإشعارات",
    markAll: "تعليم الكل كمقروء",
    all: "الكل",
    orders: "الطلبات",
    operations: "العمليات",
    system: "النظام",
    empty: "لا توجد إشعارات جديدة",
    emptyHint: "ستظهر هنا التنبيهات الجديدة الخاصة بالطلبات والعمليات.",
    unread: "غير مقروء",
    flaggedTitle: "الطلب {order} يحتاج إلى مراجعة",
    flaggedBody: "طابق {name} قواعد الحماية من الاحتيال.",
    abandonedTitle: "سلة متروكة",
    abandonedBody: "ترك {name} سلة بقيمة {amount}.",
    confirmationTitle: "{count} طلبات بانتظار التأكيد",
    confirmationBody: "تواصل مع العملاء هاتفيًا أو عبر واتساب لتأكيد طلبات الدفع عند الاستلام.",
    settlementTitle: "فرق في تسوية",
    settlementBody: "{carrier} · {ref}: فرق بقيمة {amount}.",
    campaignTitle: "حملة تتجاوز نقطة التعادل",
    campaignBody: "تكلفة الطلب المُسلَّم في حملة «{name}» أعلى من عائده. يُفضَّل إيقافها.",
    stockTitle: "مخزون منخفض",
    stockBody: "{product} ({variant}): متبقٍ {available}.",
    adAccountTitle: "حساب إعلاني يحتاج إلى إعادة ربط",
    adAccountBody: "توقفت مزامنة بيانات الإنفاق من {name}.",
    domainTitle: "النطاق غير مُتحقَّق منه",
    domainBody: "{host} بانتظار التحقق من سجلات DNS.",
  },
};

export type NotificationCategory = "orders" | "operations" | "system";
type NotificationKind = "flagged" | "abandoned" | "confirmation" | "settlement" | "campaign" | "stock" | "adAccount" | "domain";

export interface NotificationItem {
  id: string;
  kind: NotificationKind;
  category: NotificationCategory;
  at: string;
  to: string;
  params: Record<string, string | number>;
}

const KIND_META: Record<NotificationKind, { icon: LucideIcon; tone: "danger" | "warning" | "info" }> = {
  flagged: { icon: AlertTriangle, tone: "danger" },
  abandoned: { icon: ShoppingCart, tone: "info" },
  confirmation: { icon: PhoneCall, tone: "warning" },
  settlement: { icon: Coins, tone: "danger" },
  campaign: { icon: TrendingDown, tone: "danger" },
  stock: { icon: Boxes, tone: "warning" },
  adAccount: { icon: Target, tone: "warning" },
  domain: { icon: Globe, tone: "info" },
};

const TONE_CLASS = {
  danger: "bg-danger-soft text-danger",
  warning: "bg-warning-soft text-warning",
  info: "bg-primary-soft text-primary",
} as const;

const READ_KEY = "zimos.notifications.read";

export interface NotificationsState {
  items: NotificationItem[];
  loading: boolean;
  unreadCount: number;
  isRead: (id: string) => boolean;
  markRead: (id: string) => void;
  markAllRead: () => void;
}

/** Builds notifications from existing mock data. Safe to call once in the layout. */
export function useNotifications(): NotificationsState {
  const ws = useWorkspaceId();
  const [read, setRead] = useLocalStorage<string[]>(READ_KEY, []);

  const data = useAsync(async (): Promise<NotificationItem[]> => {
    if (!ws) return [];
    const [flagged, abandoned, queue, settlements, campaigns, economics, inventory, adAccounts, domains] = await Promise.all([
      mockApi.listFlagged(ws),
      mockApi.listAbandoned(ws),
      mockApi.listConfirmationQueue(ws),
      mockApi.listSettlements(ws),
      mockApi.listCampaigns(ws),
      mockApi.listEconomics(ws),
      // Real stock (same source as the Inventory page); a failure only hides stock alerts.
      listInventoryItems(ws).catch(() => []),
      mockApi.listAdAccounts(ws),
      mockApi.listDomains(ws),
    ]);
    const now = Date.now();
    const hoursAgo = (h: number) => new Date(now - h * 3600_000).toISOString();
    const items: NotificationItem[] = [];

    flagged
      .filter((f) => f.status === "flagged")
      .slice(0, 5)
      .forEach((f) =>
        items.push({
          id: `flagged:${f.id}`,
          kind: "flagged",
          category: "orders",
          at: f.createdAt,
          to: "/fraud",
          params: { order: f.orderNumber, name: f.customerName },
        })
      );

    abandoned
      .filter((a) => a.recoveryStatus === "not_contacted")
      .slice(0, 5)
      .forEach((a) =>
        items.push({
          id: `abandoned:${a.id}`,
          kind: "abandoned",
          category: "orders",
          at: a.lastActivityAt,
          to: "/abandoned-checkouts",
          params: { name: a.customerName ?? a.phone ?? "—", amount: Number(a.totalAmount), currency: a.currency },
        })
      );

    if (queue.length > 0) {
      const latest = queue.reduce((m, q) => (q.createdAt > m ? q.createdAt : m), queue[0].createdAt);
      items.push({
        id: `confirmation:${queue.length}:${latest}`,
        kind: "confirmation",
        category: "orders",
        at: latest,
        to: "/confirmation-queue",
        params: { count: queue.length },
      });
    }

    settlements
      .filter((s) => s.status === "discrepancy")
      .forEach((s) =>
        items.push({
          id: `settlement:${s.id}`,
          kind: "settlement",
          category: "operations",
          at: s.receivedAt ?? s.periodTo,
          to: "/settlements",
          params: { carrier: s.carrierName, ref: s.reference, amount: s.discrepancyAmount, currency: "EGP" },
        })
      );

    campaigns
      .filter((c) => c.status === "active")
      .forEach((c) => {
        const econ = economics.find((e) => e.productId === c.productId);
        if (!econ) return;
        const verdict = verdictFor(computeMetrics(c).cpd, computeBreakEven(econ).cpd);
        if (verdict !== "kill") return;
        const lastDay = c.daily[c.daily.length - 1]?.date;
        items.push({
          id: `campaign:${c.id}`,
          kind: "campaign",
          category: "operations",
          at: lastDay ?? hoursAgo(2),
          to: `/ads/${c.id}`,
          params: { name: c.name },
        });
      });

    inventory
      .filter((r) => r.available <= r.lowStockThreshold)
      .slice(0, 5)
      .forEach((r, i) =>
        items.push({
          id: `stock:${r.variantId}:${r.available}`,
          kind: "stock",
          category: "operations",
          at: hoursAgo(3 + i * 5),
          to: "/inventory",
          params: { product: r.productName, variant: r.variantLabel, available: r.available },
        })
      );

    adAccounts
      .filter((a) => a.status !== "connected")
      .forEach((a) =>
        items.push({
          id: `adAccount:${a.id}:${a.status}`,
          kind: "adAccount",
          category: "system",
          at: a.lastSyncAt ?? hoursAgo(24),
          to: "/ads",
          params: { name: a.name },
        })
      );

    domains
      .filter((d) => d.status === "pending_verification" || d.status === "failed")
      .forEach((d) =>
        items.push({
          id: `domain:${d.id}:${d.status}`,
          kind: "domain",
          category: "system",
          at: d.createdAt,
          to: "/settings",
          params: { host: d.hostname },
        })
      );

    return items.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  }, [ws]);

  const items = useMemo(() => data.data ?? [], [data.data]);
  const readSet = useMemo(() => new Set(read), [read]);
  const unreadCount = items.filter((i) => !readSet.has(i.id)).length;

  const markRead = useCallback(
    (id: string) => setRead((prev) => (prev.includes(id) ? prev : [...prev, id].slice(-300))),
    [setRead]
  );
  const markAllRead = useCallback(
    () => setRead((prev) => Array.from(new Set([...prev, ...items.map((i) => i.id)])).slice(-300)),
    [items, setRead]
  );
  const isRead = useCallback((id: string) => readSet.has(id), [readSet]);

  return { items, loading: data.loading, unreadCount, isRead, markRead, markAllRead };
}

type Tab = "all" | NotificationCategory;
const TABS: Tab[] = ["all", "orders", "operations", "system"];

function renderParams(params: Record<string, string | number>): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(params)) {
    if (k === "currency") continue;
    if (k === "amount" && typeof v === "number") out[k] = formatMoney(v, String(params.currency ?? "EGP"));
    else if (typeof v === "number") out[k] = formatNumber(v);
    else out[k] = v;
  }
  return out;
}

interface NotificationsDrawerProps {
  open: boolean;
  onClose: () => void;
  state: NotificationsState;
}

export function NotificationsDrawer({ open, onClose, state }: NotificationsDrawerProps) {
  const t = useT(STRINGS);
  const [tab, setTab] = useState<Tab>("all");
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      previouslyFocused?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  const tabLabel: Record<Tab, string> = { all: t.all, orders: t.orders, operations: t.operations, system: t.system };
  const visible = tab === "all" ? state.items : state.items.filter((i) => i.category === tab);

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-zimos-navy/30" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={t.title}
        tabIndex={-1}
        className="animate-zimos-slide-in-end absolute inset-y-0 end-0 flex w-full max-w-md flex-col border-s border-line bg-paper-raised pb-[env(safe-area-inset-bottom)] shadow-[var(--shadow-pop)] outline-none"
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-ink">{t.title}</h2>
            {state.unreadCount > 0 && (
              <span className="tabular rounded-full bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary">
                {formatNumber(state.unreadCount)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={state.markAllRead}
              disabled={state.unreadCount === 0}
              className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-[10px] px-2.5 text-xs font-medium text-primary transition-colors hover:bg-primary-soft disabled:cursor-default disabled:text-ink-muted disabled:hover:bg-transparent"
            >
              <CheckCheck className="size-4" aria-hidden />
              {t.markAll}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label={t.close}
              className="flex size-8 cursor-pointer items-center justify-center rounded-[10px] text-ink-muted transition-colors hover:bg-primary-soft hover:text-ink"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
        </div>

        <div role="tablist" aria-label={t.title} className="flex gap-1 border-b border-line px-3 py-2">
          {TABS.map((key) => {
            const count = (key === "all" ? state.items : state.items.filter((i) => i.category === key)).filter(
              (i) => !state.isRead(i.id)
            ).length;
            const selected = tab === key;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setTab(key)}
                className={cn(
                  "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-[10px] px-3 text-sm font-medium transition-colors",
                  selected ? "bg-primary-soft text-primary" : "text-ink-soft hover:text-ink"
                )}
              >
                {tabLabel[key]}
                {count > 0 && (
                  <span
                    className={cn(
                      "tabular rounded-full px-1.5 text-[10px] font-semibold",
                      selected ? "bg-primary text-white" : "bg-zimos-ice text-primary dark:bg-line"
                    )}
                  >
                    {formatNumber(count)}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div role="tabpanel" className="scroll-thin flex-1 overflow-y-auto">
          {visible.length === 0 ? (
            <div className="flex flex-col items-center px-8 py-16 text-center">
              <span className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-primary-soft text-primary">
                <BellOff className="size-5" aria-hidden />
              </span>
              <p className="text-sm font-semibold text-ink">{t.empty}</p>
              <p className="mt-1 text-xs text-ink-muted">{t.emptyHint}</p>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {visible.map((item) => {
                const meta = KIND_META[item.kind];
                const values = renderParams(item.params);
                const unread = !state.isRead(item.id);
                const title = fmt(t[`${item.kind}Title`], values);
                return (
                  <li key={item.id}>
                    <Link
                      to={item.to}
                      onClick={() => {
                        state.markRead(item.id);
                        onClose();
                      }}
                      className={cn(
                        "flex gap-3 px-5 py-3.5 transition-colors hover:bg-primary-soft/50",
                        unread && "bg-zimos-cloud/60 dark:bg-primary-soft/20"
                      )}
                    >
                      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-[10px]", TONE_CLASS[meta.tone])}>
                        <meta.icon className="size-4" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start gap-2">
                          <span className={cn("flex-1 text-sm text-ink", unread ? "font-semibold" : "font-medium")}>{title}</span>
                          {unread && (
                            <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary">
                              <span className="sr-only">{t.unread}</span>
                            </span>
                          )}
                        </span>
                        <span className="mt-0.5 block text-xs text-ink-soft">{fmt(t[`${item.kind}Body`], values)}</span>
                        <span className="mt-1 block text-[11px] text-ink-muted">{formatRelativeTime(item.at)}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
