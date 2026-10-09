import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import {
  IconAlarm,
  IconAnnounce,
  IconAutomations,
  IconBell,
  IconBellRinging,
  IconCheckAll,
  IconClose,
  IconCourier,
  IconCrown,
  IconDocument,
  IconDownload,
  IconHourglass,
  IconIntegration,
  IconOrders,
  IconPlugFailed,
  IconQuestions,
  IconQuotes,
  IconSettings,
  IconStockLow,
  IconWarning,
  type IconComponent,
} from "@/components/icons";
import { Button, cn } from "@store-builder/ui";
import {
  notificationsList,
  notificationsMarkAllRead,
  notificationsMarkRead,
  notificationsSummary,
  type MerchantNotificationDto,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { formatRelativeTime } from "@/lib/relativeTime";
import { NOTIFICATION_STRINGS, notificationText } from "@/lib/notificationText";
import { pluralOf } from "@/lib/plural";
import { prefetchRoute } from "@/lib/prefetch";
import { useViewNavigate } from "@/lib/viewTransition";
import { fmt, getIntlLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { FilterTabs } from "@/components/FilterTabs";
import { LoadMore } from "@/components/LoadMore";

const STRINGS = {
  en: {
    open: "Notifications",
    openUnread: "Notifications, {count}",
    title: "Notifications",
    close: "Close notifications",
    readAll: "Mark all read",
    all: "All",
    unread: "Unread",
    unreadTab: "Unread ({n})",
    allRead: "All caught up",
    unreadCount_one: "1 unread",
    unreadCount_other: "{n} unread",
    unreadMark: "Unread:",
    badgeMore: "{n}+",
    emptyTitle: "Nothing new right now",
    emptyBody: "New orders, low stock and anything that needs you will show up here.",
    emptyUnread: "No unread notifications",
    settings: "Notification settings",
    filterLabel: "Filter notifications",
    groupOrders: "Orders",
    groupStock: "Stock",
    groupShipping: "Shipping",
    groupIntegrations: "Connections and apps",
    groupFiles: "Files",
    groupZimos: "From Zimos",
    actOrderNew: "Open order",
    actOrderSuspicious: "Review order",
    actStockLow: "Restock",
    actIntegrationFailed: "Fix connection",
    actExportReady: "Download file",
    actShippingBatch: "See shipments",
    actOpen: "Open",
  },
  ar: {
    open: "الإشعارات",
    openUnread: "الإشعارات، {count}",
    title: "الإشعارات",
    close: "اقفل الإشعارات",
    readAll: "علّم الكل مقروء",
    all: "الكل",
    unread: "مش مقروءة",
    unreadTab: "مش مقروءة ({n})",
    allRead: "كله مقروء",
    unreadCount_one: "إشعار واحد مش مقروء",
    unreadCount_two: "إشعارين مش مقروءين",
    unreadCount_few: "{n} إشعارات مش مقروءة",
    unreadCount_other: "{n} إشعار مش مقروء",
    unreadMark: "مش مقروء:",
    badgeMore: "{n}+",
    emptyTitle: "مفيش جديد دلوقتي",
    emptyBody: "الأوردرات الجديدة وتنبيهات المخزون وأي حاجة محتاجاك هتظهر هنا.",
    emptyUnread: "مفيش إشعارات مش مقروءة",
    settings: "إعدادات الإشعارات",
    filterLabel: "فلترة الإشعارات",
    groupOrders: "الأوردرات",
    groupStock: "المخزون",
    groupShipping: "الشحن",
    groupIntegrations: "الربط والتطبيقات",
    groupFiles: "الملفات",
    groupZimos: "من زيموس",
    actOrderNew: "افتح الأوردر",
    actOrderSuspicious: "راجع الأوردر",
    actStockLow: "زوّد المخزون",
    actIntegrationFailed: "صلّح الربط",
    actExportReady: "نزّل الملف",
    actShippingBatch: "شوف الشحنات",
    actOpen: "افتح",
  },
} satisfies Messages;

type StringKey = keyof (typeof STRINGS)["en"];

/** How often the header asks for the unread count while the tab is visible. */
const POLL_MS = 20_000;
const PAGE_SIZE = 20;
/** The first rows of a freshly opened panel settle in one after another. */
const SETTLE_ROWS = 10;
const SETTLE_STEP_MS = 30;

/* ------------------------------------------------------------------ *
 * Kinds. A notification's type decides its group, its glyph, the tint
 * of its chip and the words on its action.
 * ------------------------------------------------------------------ */
type GroupKey = "orders" | "stock" | "shipping" | "integrations" | "files" | "zimos";
type Tone = "brand" | "accent" | "danger";

/** In the order they are drawn; `icon` stands in for a type without a glyph of its own. */
const GROUPS: ReadonlyArray<{ key: GroupKey; label: StringKey; icon: IconComponent }> = [
  { key: "orders", label: "groupOrders", icon: IconOrders },
  { key: "stock", label: "groupStock", icon: IconStockLow },
  { key: "shipping", label: "groupShipping", icon: IconCourier },
  { key: "integrations", label: "groupIntegrations", icon: IconIntegration },
  { key: "files", label: "groupFiles", icon: IconDocument },
  { key: "zimos", label: "groupZimos", icon: IconBell },
];

function groupOf(type: string): GroupKey {
  if (type.startsWith("order.")) return "orders";
  if (type.startsWith("stock.")) return "stock";
  if (type.startsWith("shipping.")) return "shipping";
  if (type.startsWith("integration.")) return "integrations";
  if (type.startsWith("export.")) return "files";
  // Announcements, automations and any type a newer backend adds.
  return "zimos";
}

const ICONS: Partial<Record<string, IconComponent>> = {
  "order.new": IconOrders,
  "order.suspicious": IconWarning,
  "stock.low": IconStockLow,
  "stock.lot_expiring": IconHourglass,
  "integration.failed": IconPlugFailed,
  "export.ready": IconDownload,
  "shipping.batch_done": IconCourier,
  announcement: IconAnnounce,
  automation: IconAutomations,
  "plan.limit_reached": IconCrown,
  "customer.followup": IconAlarm,
  "quote.request": IconQuotes,
  "product.question": IconQuestions,
};

function iconOf(type: string): IconComponent {
  const own = ICONS[type];
  if (own) return own;
  const group = groupOf(type);
  return GROUPS.find((g) => g.key === group)?.icon ?? IconBell;
}

function toneOf(type: string): Tone {
  if (type === "order.suspicious" || type === "integration.failed") return "danger";
  if (type === "stock.low") return "accent";
  return "brand";
}

/** The chip without the glass layer; glass/notifications.css tints it when the layer is on. */
const TONE_CLASS: Record<Tone, string> = {
  brand: "bg-primary-soft text-primary-dark dark:text-primary",
  accent: "bg-accent-soft text-accent-dark",
  danger: "bg-danger-soft text-danger",
};

const ACTIONS: Partial<Record<string, StringKey>> = {
  "order.new": "actOrderNew",
  "order.suspicious": "actOrderSuspicious",
  "stock.low": "actStockLow",
  "integration.failed": "actIntegrationFailed",
  "export.ready": "actExportReady",
  "shipping.batch_done": "actShippingBatch",
};

/** What the pill on a notification says its link does. */
function actionOf(n: MerchantNotificationDto): StringKey {
  // A file that could not be prepared has nothing to download.
  if (n.type === "export.ready" && n.data?.failed) return "actOpen";
  // An order the courier could not book on its own: the fix is on the order page.
  if (n.type === "integration.failed" && n.data?.orderNumber) return "actOrderNew";
  return ACTIONS[n.type] ?? "actOpen";
}

/**
 * The new-order chime: two short notes from the Web Audio API, so there is no
 * sound file to ship. Browsers only allow audio after the person has
 * interacted with the page; before that the call fails silently.
 */
function playChime() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const note = (frequency: number, at: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + at);
      gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + 0.28);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + at);
      osc.stop(ctx.currentTime + at + 0.3);
    };
    note(880, 0);
    note(1174.66, 0.16);
    window.setTimeout(() => void ctx.close(), 800);
  } catch {
    // No audio device or not allowed yet: the badge still updates.
  }
}

/** The bell in the toolbar: unread badge, new-order sound, and the Notification Centre. */
export function NotificationsBell() {
  const workspaceId = useWorkspaceId();
  const t = useT(STRINGS);
  // `rose` is true only when the count went up, so the badge pops for news and not for reading.
  const [badge, setBadge] = useState<{ count: number; rose: boolean }>({ count: 0, rose: false });
  const [open, setOpen] = useState(false);
  const bellRef = useRef<HTMLButtonElement>(null);
  // The newest new-order notification already seen, per store; null until the
  // first answer so opening the dashboard never rings for old orders.
  const lastOrderAt = useRef<string | null | undefined>(undefined);

  const applyUnread = useCallback((count: number) => {
    setBadge((prev) => (prev.count === count ? prev : { count, rose: count > prev.count }));
  }, []);
  const close = useCallback(() => setOpen(false), []);

  const poll = useCallback(async () => {
    if (!workspaceId) return;
    try {
      const summary = await notificationsSummary(apiClient, workspaceId);
      applyUnread(summary.unreadCount);
      const latest = summary.latestOrderNotificationAt;
      if (lastOrderAt.current !== undefined && latest && (!lastOrderAt.current || latest > lastOrderAt.current)) {
        if (summary.soundEnabled) playChime();
      }
      lastOrderAt.current = latest;
    } catch {
      // A failed poll keeps the last known count; the next one retries.
    }
  }, [workspaceId, applyUnread]);

  useEffect(() => {
    lastOrderAt.current = undefined;
    setBadge({ count: 0, rose: false });
    void poll();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void poll();
    }, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void poll();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [poll]);

  if (!workspaceId) return null;

  const count = badge.count;
  const Glyph = count > 0 ? IconBellRinging : IconBell;

  return (
    <>
      <button
        ref={bellRef}
        type="button"
        data-slot="notifications-bell"
        onClick={() => setOpen(true)}
        aria-label={count > 0 ? fmt(t.openUnread, { count: pluralOf(t, "unreadCount", count) }) : t.open}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="relative flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-soft transition-[scale,background-color,color] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-primary-soft hover:text-ink focus-visible:outline-2 focus-visible:outline-primary active:scale-[0.97] aria-expanded:bg-primary-soft aria-expanded:text-primary-dark motion-reduce:transition-none dark:aria-expanded:text-primary pointer-coarse:size-11"
      >
        <Glyph className="size-5" weight={open ? "fill" : "regular"} aria-hidden />
        {count > 0 && (
          <span
            // Keyed by the count: a new number is a new element, so the pop plays again.
            key={count}
            data-testid="notifications-badge"
            data-slot="notifications-badge"
            className={cn(
              "pointer-events-none absolute -end-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-danger px-1 text-[11px] leading-none font-semibold text-paper-raised tabular-nums ring-2 ring-paper-raised pointer-coarse:end-0.5 pointer-coarse:top-0.5",
              badge.rose && "animate-[notifications-badge-pop_var(--dur-pop)_var(--ease-pop)_both] motion-reduce:animate-none"
            )}
          >
            {count > 99 ? fmt(t.badgeMore, { n: 99 }) : new Intl.NumberFormat(getIntlLocale()).format(count)}
          </span>
        )}
      </button>
      {/* Base UI's Dialog: portalled to <body>, focus trapped inside and returned to the bell, Esc closes. */}
      <DialogPrimitive.Root open={open} onOpenChange={(next) => setOpen(next)}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Backdrop
            data-slot="notifications-backdrop"
            className="fixed inset-0 z-50 bg-black/45 transition-opacity duration-[var(--dur-move)] ease-[var(--ease-out)] [view-transition-name:notifications-backdrop] data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 motion-reduce:transition-none sm:bg-black/25"
          />
          <NotificationsPanel
            workspaceId={workspaceId}
            initialUnread={count}
            bellRef={bellRef}
            onClose={close}
            onUnreadCount={applyUnread}
          />
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}

/**
 * The phone sheet follows a finger dragged down from its header: past 120px,
 * or on a flick, it closes; otherwise it springs back. Only the translate
 * moves, written straight to the element so a drag never re-renders the list.
 * From `sm` up the panel is a side pane and does not drag.
 */
function useSheetDrag(popupRef: RefObject<HTMLDivElement | null>, onDismiss: () => void) {
  const drag = useRef<{ pointerId: number; startY: number; lastY: number; lastAt: number; velocity: number } | null>(null);

  const finish = (e: ReactPointerEvent<HTMLElement>, cancelled: boolean) => {
    const state = drag.current;
    if (!state || e.pointerId !== state.pointerId) return;
    drag.current = null;
    const el = popupRef.current;
    if (!el) return;
    const dy = Math.max(0, e.clientY - state.startY);
    // Back on the house spring: to rest, or — closed in this same event — on to the bottom edge.
    el.style.transition = "";
    el.style.translate = "";
    if (!cancelled && (dy > 120 || (dy > 24 && state.velocity > 0.6))) onDismiss();
  };

  return {
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => {
      const el = popupRef.current;
      if (!el || e.button !== 0 || drag.current) return;
      if (window.matchMedia("(min-width: 40rem)").matches) return;
      if ((e.target as Element).closest("button, a, input")) return;
      drag.current = { pointerId: e.pointerId, startY: e.clientY, lastY: e.clientY, lastAt: e.timeStamp, velocity: 0 };
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // No capture (an old browser): the drag still follows while the finger stays on the header.
      }
      el.style.transition = "none";
    },
    onPointerMove: (e: ReactPointerEvent<HTMLElement>) => {
      const state = drag.current;
      const el = popupRef.current;
      if (!state || !el || e.pointerId !== state.pointerId) return;
      const elapsed = e.timeStamp - state.lastAt;
      if (elapsed > 0) state.velocity = (e.clientY - state.lastY) / elapsed;
      state.lastY = e.clientY;
      state.lastAt = e.timeStamp;
      el.style.translate = `0 ${Math.max(0, e.clientY - state.startY)}px`;
    },
    onPointerUp: (e: ReactPointerEvent<HTMLElement>) => finish(e, false),
    onPointerCancel: (e: ReactPointerEvent<HTMLElement>) => finish(e, true),
  };
}

/*
 * The pane. Without the glass layer it is a solid raised card with a hairline
 * and the pop shadow; glass/notifications.css makes it an overlay pane.
 * Phone: a sheet risen from the bottom edge (its ::after continues the fill
 * below the screen, so the spring's overshoot never shows a gap). From `sm`:
 * a pane floating 12px inside the end edge, slid in from that edge.
 */
const PANEL_CLASS = [
  "fixed start-0 end-0 bottom-0 z-50 flex h-[90dvh] flex-col rounded-t-[1.75rem] bg-paper-raised text-ink shadow-[var(--shadow-pop)] ring-1 ring-line outline-none [view-transition-name:notifications-panel]",
  "max-sm:after:absolute max-sm:after:start-0 max-sm:after:end-0 max-sm:after:top-full max-sm:after:h-24 max-sm:after:bg-paper-raised",
  "sm:start-auto sm:end-3 sm:top-3 sm:bottom-3 sm:h-auto sm:w-[26rem] sm:max-w-[calc(100vw-1.5rem)] sm:rounded-[1.75rem]",
  "transition-[translate,opacity] duration-[var(--dur-move)] ease-[var(--ease-spring)] motion-reduce:transition-none",
  "max-sm:data-[ending-style]:translate-y-full max-sm:data-[starting-style]:translate-y-full",
  "sm:data-[ending-style]:opacity-0 sm:data-[starting-style]:opacity-0",
  "sm:ltr:data-[ending-style]:translate-x-[calc(100%+0.75rem)] sm:ltr:data-[starting-style]:translate-x-[calc(100%+0.75rem)]",
  "sm:rtl:data-[ending-style]:-translate-x-[calc(100%+0.75rem)] sm:rtl:data-[starting-style]:-translate-x-[calc(100%+0.75rem)]",
].join(" ");

function NotificationsPanel({
  workspaceId,
  initialUnread,
  bellRef,
  onClose,
  onUnreadCount,
}: {
  workspaceId: string;
  /** What the bell already knows, so the header does not say «كله مقروء» while the list loads. */
  initialUnread: number;
  bellRef: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  onUnreadCount: (n: number) => void;
}) {
  const t = useT(STRINGS);
  const go = useViewNavigate();
  const headingId = useId();
  const popupRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [items, setItems] = useState<MerchantNotificationDto[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [unread, setUnread] = useState(initialUnread);
  // True until the first rows have settled in; rows that arrive later just appear.
  const [settle, setSettle] = useState(true);
  const call = useRef(0);
  // Ids being marked read, and whether the panel is already on its way out:
  // a second tap on a row or its pill does nothing.
  const marking = useRef<Set<string>>(new Set());
  const leaving = useRef(false);
  const drag = useSheetDrag(popupRef, onClose);

  const load = useCallback(
    async (cursor: string | null) => {
      const id = ++call.current;
      if (cursor) setLoadingMore(true);
      else setLoading(true);
      setError(null);
      try {
        const page = await notificationsList(apiClient, workspaceId, { limit: PAGE_SIZE, cursor, unread: filter === "unread" });
        if (id !== call.current) return;
        setItems((prev) => (cursor ? [...prev, ...page.notifications] : page.notifications));
        setNextCursor(page.nextCursor);
        setUnread(page.unreadCount);
        onUnreadCount(page.unreadCount);
      } catch (err) {
        if (id === call.current) setError(err);
      } finally {
        if (id === call.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [workspaceId, filter, onUnreadCount]
  );

  useEffect(() => {
    void load(null);
  }, [load]);

  useEffect(() => {
    if (!settle || loading || items.length === 0) return;
    const timer = window.setTimeout(() => setSettle(false), SETTLE_ROWS * SETTLE_STEP_MS + 400);
    return () => window.clearTimeout(timer);
  }, [settle, loading, items.length]);

  /** Close the panel and go to `to` in a view transition — once. */
  function leave(to: string) {
    if (leaving.current) return;
    leaving.current = true;
    // Released once the pane has gone, in case it is opened again before it unmounts.
    window.setTimeout(() => {
      leaving.current = false;
    }, 600);
    onClose();
    go(to);
  }

  /** A row or its pill: mark it read (shown at once), then follow its link if it has one. */
  function activate(n: MerchantNotificationDto) {
    if (leaving.current) return;
    if (!n.readAt && !marking.current.has(n.id)) {
      marking.current.add(n.id);
      const readAt = new Date().toISOString();
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, readAt } : x)));
      const left = Math.max(0, unread - 1);
      setUnread(left);
      onUnreadCount(left);
      void notificationsMarkRead(apiClient, workspaceId, n.id)
        .then((result) => {
          setUnread(result.unreadCount);
          onUnreadCount(result.unreadCount);
        })
        .catch(() => {
          // Still navigate: reading it again later is harmless.
        })
        .finally(() => {
          marking.current.delete(n.id);
        });
    }
    if (n.link) leave(n.link);
  }

  async function readAll() {
    const readAt = new Date().toISOString();
    setItems((prev) => (filter === "unread" ? [] : prev.map((x) => (x.readAt ? x : { ...x, readAt }))));
    setUnread(0);
    onUnreadCount(0);
    try {
      await notificationsMarkAllRead(apiClient, workspaceId);
    } catch (err) {
      setError(err);
    }
  }

  /** Up / Down / Home / End walk the rows as one list, whatever group they sit in. */
  function onListKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "Home" && e.key !== "End") return;
    const rows = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>("[data-notification-row]"));
    const at = rows.indexOf(e.target as HTMLButtonElement);
    if (at === -1) return;
    e.preventDefault();
    const next =
      e.key === "Home" ? 0 : e.key === "End" ? rows.length - 1 : e.key === "ArrowDown" ? Math.min(rows.length - 1, at + 1) : Math.max(0, at - 1);
    rows[next]?.focus();
  }

  // Grouped by kind in the fixed order, newest first inside a group; `order`
  // is the row's place in the whole list (the settle delay follows it).
  const groups = useMemo(() => {
    const buckets = new Map<GroupKey, MerchantNotificationDto[]>();
    for (const n of items) {
      const key = groupOf(n.type);
      const bucket = buckets.get(key);
      if (bucket) bucket.push(n);
      else buckets.set(key, [n]);
    }
    let order = 0;
    return GROUPS.flatMap((group) => {
      const bucket = buckets.get(group.key);
      if (!bucket || bucket.length === 0) return [];
      const sorted = [...bucket].sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
      return [
        {
          key: group.key,
          label: group.label,
          unread: sorted.filter((n) => !n.readAt).length,
          rows: sorted.map((n) => ({ n, order: order++ })),
        },
      ];
    });
  }, [items]);

  const numbers = new Intl.NumberFormat(getIntlLocale());

  return (
    <DialogPrimitive.Popup
      ref={popupRef}
      data-slot="notifications-panel"
      // A keyboard or mouse lands on Close, not on «علّم الكل مقروء»; a touch keeps Base UI's default (the pane itself).
      initialFocus={(openType) => (openType === "touch" ? true : closeRef.current)}
      finalFocus={bellRef}
      className={PANEL_CLASS}
    >
      <div
        data-slot="notifications-header"
        className="shrink-0 px-5 pt-2 pb-3 max-sm:touch-none max-sm:select-none sm:pt-4"
        {...drag}
      >
        <span data-slot="notifications-grabber" aria-hidden className="mx-auto mb-2 block h-1.5 w-10 rounded-full bg-line-strong/45 sm:hidden" />
        <div className="flex items-center gap-1">
          <div className="min-w-0 flex-1">
            <DialogPrimitive.Title className="truncate font-display text-lg leading-7 font-semibold text-ink">{t.title}</DialogPrimitive.Title>
            <DialogPrimitive.Description className="truncate text-xs leading-4 text-ink-soft">
              {unread > 0 ? pluralOf(t, "unreadCount", unread) : t.allRead}
            </DialogPrimitive.Description>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void readAll()}
            disabled={unread === 0}
            className="h-9 rounded-full px-3 text-[13px] text-primary-dark active:scale-[0.97] motion-reduce:transition-none dark:text-primary"
          >
            <IconCheckAll className="size-4" weight="bold" aria-hidden />
            {t.readAll}
          </Button>
          <DialogPrimitive.Close
            ref={closeRef}
            aria-label={t.close}
            data-slot="notifications-close"
            className="-me-3 flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-soft transition-[scale,background-color,color] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-paper-sunken hover:text-ink focus-visible:outline-2 focus-visible:outline-primary active:scale-[0.97] motion-reduce:transition-none"
          >
            <IconClose className="size-5" aria-hidden />
          </DialogPrimitive.Close>
        </div>
      </div>

      <div data-slot="notifications-filter" className="shrink-0 px-5 pb-3">
        <FilterTabs
          value={filter}
          onChange={setFilter}
          label={t.filterLabel}
          className="rounded-full"
          buttonClassName="min-h-9 rounded-full px-4"
          tabs={[
            { value: "all", label: t.all },
            { value: "unread", label: unread > 0 ? fmt(t.unreadTab, { n: unread }) : t.unread },
          ]}
        />
      </div>

      <div
        data-slot="notifications-list"
        onKeyDown={onListKeyDown}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain border-t border-line px-2 py-2 [scrollbar-width:thin]"
      >
        <DataState loading={loading} error={error} onRetry={() => void load(null)} skeleton={<RowsSkeleton />}>
          {groups.length === 0 ? (
            <EmptyState
              // `page-in` (inside EmptyState) is named "page" while a view transition runs; a second
              // "page" beside the real one would abort the transition, so this one is never named.
              className="border-0 bg-transparent px-4 py-14 [view-transition-name:none]!"
              icon={<IconBell weight="duotone" aria-hidden />}
              title={filter === "unread" ? t.emptyUnread : t.emptyTitle}
              description={filter === "unread" ? undefined : t.emptyBody}
            />
          ) : (
            groups.map((group) => (
              <section key={group.key} aria-labelledby={`${headingId}-${group.key}`} className="pb-1">
                <h3
                  id={`${headingId}-${group.key}`}
                  data-slot="notifications-group"
                  className="flex items-center gap-1.5 px-3 pt-2 pb-1.5 text-[11px] leading-4 font-semibold text-ink-soft"
                >
                  {t[group.label]}
                  {group.unread > 0 && (
                    <span
                      data-slot="notifications-group-count"
                      className="relative inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary-soft px-1 text-[11px] leading-none text-primary-dark tabular-nums dark:text-primary"
                    >
                      <span aria-hidden>{numbers.format(group.unread)}</span>
                      <span className="sr-only">{pluralOf(t, "unreadCount", group.unread)}</span>
                    </span>
                  )}
                </h3>
                <ul className="space-y-0.5">
                  {group.rows.map(({ n, order }) => (
                    <NotificationRow key={n.id} n={n} settleAt={settle && order < SETTLE_ROWS ? order : null} onActivate={activate} />
                  ))}
                </ul>
              </section>
            ))
          )}
          <div className="pb-1">
            <LoadMore hasMore={Boolean(nextCursor)} loading={loadingMore} onClick={() => void load(nextCursor)} />
          </div>
        </DataState>
      </div>

      <div
        data-slot="notifications-footer"
        className="shrink-0 border-t border-line px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:pb-2"
      >
        <button
          type="button"
          onClick={() => leave("/settings#notifications")}
          onPointerEnter={() => prefetchRoute("/settings")}
          className="flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-full text-sm font-medium text-primary-dark transition-[scale,background-color] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-primary-soft focus-visible:outline-2 focus-visible:outline-primary active:scale-[0.97] motion-reduce:transition-none dark:text-primary"
        >
          <IconSettings className="size-4" weight="bold" aria-hidden />
          {t.settings}
        </button>
      </div>
    </DialogPrimitive.Popup>
  );
}

/**
 * One notification. The whole row is one button (a stretched one under the
 * content), so it is a single stop for Tab and the arrow keys; the pill names
 * what that button does and is the same action for a pointer — a sibling of
 * the row button, not a child, so one tap never fires twice. The pill's words
 * are read as the row's description.
 */
function NotificationRow({
  n,
  settleAt,
  onActivate,
}: {
  n: MerchantNotificationDto;
  /** The row's place among the first rows of a fresh panel, or null when it should just appear. */
  settleAt: number | null;
  onActivate: (n: MerchantNotificationDto) => void;
}) {
  const t = useT(STRINGS);
  const nt = useT(NOTIFICATION_STRINGS);
  const id = useId();
  const text = notificationText(nt, n);
  const isUnread = !n.readAt;
  const Glyph = iconOf(n.type);
  const tone = toneOf(n.type);
  const action = n.link ? t[actionOf(n)] : null;
  const warm = () => {
    if (n.link) prefetchRoute(n.link);
  };

  return (
    <li
      data-slot="notifications-row"
      data-unread={isUnread ? "" : undefined}
      style={settleAt === null ? undefined : { animationDelay: `${settleAt * SETTLE_STEP_MS}ms` }}
      className={cn(
        "relative flex min-h-14 items-start gap-3 rounded-2xl px-3 py-2.5 transition-[scale,background-color] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-paper-sunken active:scale-[0.985] data-[unread]:bg-primary-soft/55 data-[unread]:hover:bg-primary-soft/80 motion-reduce:transition-none",
        settleAt !== null && "animate-[notifications-row-in_var(--dur-move)_var(--ease-out)_backwards] motion-reduce:animate-none"
      )}
    >
      <button
        type="button"
        data-notification-row
        aria-labelledby={`${id}-title`}
        aria-describedby={[text.body ? `${id}-body` : null, `${id}-time`, action ? `${id}-action` : null].filter(Boolean).join(" ")}
        onClick={() => onActivate(n)}
        onPointerEnter={warm}
        onTouchStart={warm}
        onFocus={warm}
        className="absolute inset-0 cursor-pointer rounded-2xl focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
      />
      <span
        data-slot="notifications-chip"
        data-tone={tone}
        className={cn("pointer-events-none relative flex size-9 shrink-0 items-center justify-center rounded-full", TONE_CLASS[tone])}
      >
        <Glyph className="size-[18px]" weight="fill" aria-hidden />
      </span>
      <div className="pointer-events-none relative min-w-0 flex-1">
        <p id={`${id}-title`} className={cn("text-sm leading-5 break-words text-ink", isUnread ? "font-semibold" : "font-normal")}>
          {isUnread && <span className="sr-only">{t.unreadMark} </span>}
          {text.title}
        </p>
        {text.body && (
          <p id={`${id}-body`} className="mt-0.5 text-[13px] leading-5 break-words text-ink-soft">
            {text.body}
          </p>
        )}
        <div className={cn("mt-1 flex items-center justify-between gap-2", action && "min-h-8")}>
          <time id={`${id}-time`} dateTime={n.createdAt} className="text-xs leading-4 text-ink-soft">
            {formatRelativeTime(n.createdAt)}
          </time>
          {action && (
            <button
              type="button"
              id={`${id}-action`}
              data-slot="notifications-action"
              // The row button already carries this action for the keyboard and for screen readers.
              tabIndex={-1}
              aria-hidden="true"
              onClick={() => onActivate(n)}
              className="pointer-events-auto inline-flex h-8 shrink-0 cursor-pointer items-center rounded-full bg-paper-raised px-3 text-xs font-semibold text-primary-dark ring-1 ring-line transition-[scale,background-color] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-primary-soft active:scale-[0.97] motion-reduce:transition-none dark:text-primary"
            >
              {action}
            </button>
          )}
        </div>
      </div>
      <span
        data-slot="notifications-dot"
        data-on={isUnread ? "" : undefined}
        aria-hidden
        className={cn("pointer-events-none relative mt-1.5 size-2 shrink-0 rounded-full", isUnread ? "bg-primary" : "bg-transparent")}
      />
    </li>
  );
}

// Title widths per placeholder row, so they do not line up in a block.
const SKELETON_ROWS = ["w-3/5", "w-2/5", "w-1/2", "w-2/3", "w-2/5"] as const;

/** Rows in the shape of the list while the first page loads. */
function RowsSkeleton() {
  return (
    <div className="pt-1">
      {SKELETON_ROWS.map((width, i) => (
        <div key={i} className="flex min-h-14 items-start gap-3 px-3 py-2.5">
          <div className="size-9 shrink-0 animate-pulse rounded-full bg-paper-sunken motion-reduce:animate-none" />
          <div className="min-w-0 flex-1 pt-1.5">
            <div className={cn("h-3 animate-pulse rounded-full bg-paper-sunken motion-reduce:animate-none", width)} />
            <div className="mt-2.5 h-2.5 w-4/5 animate-pulse rounded-full bg-paper-sunken motion-reduce:animate-none" />
          </div>
        </div>
      ))}
    </div>
  );
}
