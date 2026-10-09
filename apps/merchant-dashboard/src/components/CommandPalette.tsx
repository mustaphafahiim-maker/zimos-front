import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { cn } from "@store-builder/ui";
import { dashboardSearch, type DashboardSearchResult } from "@store-builder/api-client";
import {
  IconArrowDown,
  IconArrowUp,
  IconClose,
  IconConfirm,
  IconContacts,
  IconEnter,
  IconExternal,
  IconFunnels,
  IconKeyboard,
  IconLanguage,
  IconMoon,
  IconOrders,
  IconPercent,
  IconPhone,
  IconPlus,
  IconProduct,
  IconProducts,
  IconSearch,
  IconSpinner,
  IconStore,
  IconSun,
  IconTray,
  IconUser,
  IconWarning,
  IconWhatsApp,
  type IconComponent,
} from "@/components/icons";
import { SHORTCUTS_HELP_EVENT } from "@/components/KeyboardShortcuts";
import { apiClient } from "@/lib/apiClient";
import { useWorkspace } from "@/context/WorkspaceContext";
import { NAV_GROUP_LABELS, NAV_ITEMS, NAV_LABELS, findNavGroup, findNavItem, isNavItemVisible, type NavItem } from "@/lib/navigation";
import { formatMoney, formatProductCode, humanize } from "@/lib/format";
import { countOf, pluralOf } from "@/lib/plural";
import { prefetchRoute } from "@/lib/prefetch";
import { storeHost, storeUrl } from "@/lib/storeAddress";
import { useViewNavigate } from "@/lib/viewTransition";
import { toWhatsAppNumber } from "@/lib/whatsapp";
import {
  clearSpotlightRecents,
  looksLikePhone,
  readSpotlightRecents,
  rememberSpotlightRecent,
  type SpotlightRecent,
} from "@/lib/spotlightRecents";
import { fmt, useLocale, useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    open: "Search",
    placeholder: "Search anything…",
    clear: "Clear what you typed",
    close: "Close search",
    cancel: "Cancel",
    searching: "Searching…",
    nothing: "Nothing matches “{q}”",
    hint: "Try an order number, a phone or its last digits, a name — or the page you want.",
    failed: "We couldn't search your orders, products and customers. Check your connection and try again.",
    retry: "Try again",
    recents: "Recent",
    clearRecents: "Clear",
    clearRecentsLabel: "Clear recent items",
    commands: "Quick actions",
    pages: "Pages",
    orders: "Orders",
    products: "Products",
    customers: "Customers",
    funnels: "Funnels",
    hits_one: "1 result",
    hits_two: "{n} results",
    hits_few: "{n} results",
    hits_other: "{n} results",
    cmdNewOrder: "New order",
    cmdNewProduct: "Add a product",
    cmdConfirm: "Start confirming orders",
    cmdOrders: "All orders",
    cmdNewDiscount: "New discount",
    cmdAllStores: "All my stores",
    cmdForms: "Form submissions",
    cmdSegments: "Contact segments",
    cmdOpenStore: "Open my store",
    cmdTheme: "Switch appearance",
    themeToDark: "To dark mode",
    themeToLight: "To light mode",
    cmdLanguage: "Change language",
    languageTo: "العربية",
    cmdShortcuts: "Keyboard shortcuts",
    wordsStore: "storefront website shop visit view",
    wordsTheme: "dark light night mode theme",
    wordsLanguage: "arabic english عربي",
    wordsShortcuts: "keys hotkeys help",
    verbOpen: "Open",
    verbRun: "Run",
    keysMove: "to move",
    keysOpen: "to open",
    keysClose: "to close",
    callName: "Call {name}",
    whatsappName: "WhatsApp {name}",
    kindOrder: "Order",
    kindProduct: "Product",
    kindCustomer: "Customer",
    kindFunnel: "Funnel",
    kindPage: "Page",
    kindAction: "Quick action",
  },
  ar: {
    open: "بحث",
    placeholder: "دوّر على أي حاجة…",
    clear: "امسح اللي كتبته",
    close: "اقفل البحث",
    cancel: "إلغاء",
    searching: "بندوّر…",
    nothing: "مفيش نتايج لـ «{q}»",
    hint: "جرّب رقم أوردر، موبايل أو آخر أرقامه، اسم — أو الصفحة اللي عايزها.",
    failed: "معرفناش ندوّر في الأوردرات والمنتجات والعملاء. اتأكد من النت وجرّب تاني.",
    retry: "جرّب تاني",
    recents: "الأخيرة",
    clearRecents: "امسح",
    clearRecentsLabel: "امسح الأخيرة",
    commands: "اعمل بسرعة",
    pages: "الصفحات",
    orders: "الأوردرات",
    products: "المنتجات",
    customers: "العملاء",
    funnels: "مسارات البيع",
    hits_one: "نتيجة واحدة",
    hits_two: "نتيجتين",
    hits_few: "{n} نتايج",
    hits_other: "{n} نتيجة",
    cmdNewOrder: "أوردر جديد",
    cmdNewProduct: "ضيف منتج",
    cmdConfirm: "ابدأ تأكيد الأوردرات",
    cmdOrders: "كل الأوردرات",
    cmdNewDiscount: "خصم جديد",
    cmdAllStores: "كل متاجري",
    cmdForms: "رسايل الفورم",
    cmdSegments: "شرايح جهات الاتصال",
    cmdOpenStore: "افتح متجري",
    cmdTheme: "بدّل الوضع",
    themeToDark: "للوضع الغامق",
    themeToLight: "للوضع الفاتح",
    cmdLanguage: "غيّر اللغة",
    languageTo: "English",
    cmdShortcuts: "اختصارات الكيبورد",
    wordsStore: "الموقع المتجر زيارة معاينة شوف",
    wordsTheme: "غامق فاتح ليلي نهاري دارك لايت ثيم مظهر",
    wordsLanguage: "عربي انجليزي english لغة",
    wordsShortcuts: "مفاتيح اختصار مساعدة",
    verbOpen: "افتح",
    verbRun: "نفّذ",
    keysMove: "يتنقل",
    keysOpen: "يفتح",
    keysClose: "يقفل",
    callName: "اتصل بـ {name}",
    whatsappName: "واتساب لـ {name}",
    kindOrder: "أوردر",
    kindProduct: "منتج",
    kindCustomer: "عميل",
    kindFunnel: "مسار بيع",
    kindPage: "صفحة",
    kindAction: "أمر سريع",
  },
} satisfies Messages;

/**
 * Lower-case, without Arabic diacritics or tatweel, and with the letters
 * people type interchangeably folded together (أ إ آ → ا, ة → ه, ى → ي), so
 * «اعدادات» finds «الإعدادات» (audit U-34). Latin text just lower-cases.
 */
function foldForSearch(text: string): string {
  return text
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .trim();
}

type Section = "recent" | "order" | "product" | "customer" | "funnel" | "action" | "page";
type RecordKind = "order" | "product" | "customer" | "funnel";

/**
 * One row. It either goes somewhere (`to`, a dashboard route, opened in a view
 * transition) or does something (`run`) — never both.
 */
interface Entry {
  /** Unique in the list. */
  id: string;
  section: Section;
  icon: IconComponent;
  /** A product's photo, drawn in the chip in place of the icon. */
  image?: string | null;
  title: ReactNode;
  detail?: ReactNode;
  to?: string;
  run?: () => void;
  /** What Enter does, said at the row's end. "open" unless stated. */
  verb?: "open" | "run";
  /** Kept under «الأخيرة» when the row is opened. Only rows with `to` have one. */
  recent?: SpotlightRecent;
  /** A customer's number: call and WhatsApp from the row itself. */
  contact?: { phone: string; name: string };
}

/** An action also carries the plain words it is found by. */
interface ActionEntry extends Entry {
  label: string;
  words?: string;
}

interface SectionModel {
  key: Section;
  heading: string;
  /** Hits in a group of records; undefined for recents, actions and pages. */
  count?: number;
  /** Index of the group's first row in the flat list. */
  start: number;
  entries: Entry[];
}

const EMPTY: DashboardSearchResult = { orders: [], products: [], customers: [], funnels: [] };
const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
/** With nothing typed the launcher lists this many pages; typing finds the rest. */
const PAGES_AT_REST = 8;

const KIND_ICONS: Record<RecordKind, IconComponent> = {
  order: IconOrders,
  product: IconProducts,
  customer: IconUser,
  funnel: IconFunnels,
};

/** The page a route belongs to, without its query or hash. */
function pathOf(to: string): string {
  return to.split(/[?#]/)[0] || "/";
}

/** Digits a phone dialer accepts: Arabic-Indic digits folded, spaces and dashes dropped. */
function telHref(phone: string): string {
  const ascii = phone.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
  return `tel:${ascii.replace(/[^\d+]/g, "")}`;
}

/**
 * A stored image URL as a path the dashboard can load — the same host
 * stripping as `imageSrc` in lib/media.ts, kept here so the shell does not
 * pull the upload tools into its first chunk.
 */
function thumbSrc(url: string | null): string | null {
  if (!url) return null;
  if (url.startsWith("data:") || url.startsWith("blob:") || url.startsWith("/")) return url;
  try {
    const parsed = new URL(url);
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return url;
  }
}

/**
 * Light ↔ dark, the way components/ThemeToggle.tsx does it: the `dark` class
 * and `color-scheme` on <html>, the choice in localStorage "theme". That file
 * exports only its button, so a toggle that is on screen (Settings →
 * appearance) hears about it through the `storage` event it already listens for.
 */
function switchTheme(): void {
  const el = document.documentElement;
  const next = el.classList.contains("dark") ? "light" : "dark";
  el.classList.toggle("dark", next === "dark");
  el.style.colorScheme = next;
  try {
    localStorage.setItem("theme", next);
  } catch {
    /* private mode — the choice lasts until the page is reloaded */
  }
  try {
    window.dispatchEvent(new StorageEvent("storage", { key: "theme", newValue: next }));
  } catch {
    /* an engine without the constructor: the toggle catches up on its next render */
  }
}

/**
 * Spotlight (SPEC §18.6): ⌘K / Ctrl+K from anywhere in the dashboard — the one
 * place to find a record, jump to a page or do something.
 *
 * Nothing typed: what was opened last from here, then the quick actions, then
 * the first pages. Typed: records first (GET /search — orders by number or
 * phone, products, customers, funnels), then the actions and pages that match
 * in the language the dashboard is shown in. Only the request waits 200ms;
 * the field and the local matches follow every key.
 *
 * Structure and sizes are here; the glass (pane, rims, the brand chip) is in
 * glass/spotlight.css.
 */
export function CommandPalette() {
  const t = useT(STRINGS);
  const navLabels = useT(NAV_LABELS);
  const groupLabels = useT(NAV_GROUP_LABELS);
  const { locale, toggleLocale } = useLocale();
  const navigate = useViewNavigate();
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id;
  const role = currentWorkspace?.role;
  const slug = currentWorkspace?.slug;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DashboardSearchResult>(EMPTY);
  const [searching, setSearching] = useState(false);
  const [failed, setFailed] = useState(false);
  /** Bumped by «جرّب تاني» to send the same search again. */
  const [attempt, setAttempt] = useState(0);
  /** The active row, kept with the list it was chosen in: a list that changed starts at its first row. */
  const [activeAt, setActiveAt] = useState<{ list: string; index: number }>({ list: "", index: 0 });
  const [recents, setRecents] = useState<SpotlightRecent[]>([]);
  const [dark, setDark] = useState(false);
  /** The visible height on a phone: the on-screen keyboard covers the rest. */
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  /** Only a move made with the keyboard scrolls the list; pointing at a row never does. */
  const followActive = useRef(false);
  /** Where the pointer last was over the list, to tell a real move from a list that changed under it. */
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const baseId = useId();
  const listId = `${baseId}-list`;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // By letter or by physical key: on an Arabic layout Ctrl+K reports «ن».
      // "/" in KeyboardShortcuts arrives here as a made-up Ctrl+K that only has `key`.
      if ((e.metaKey || e.ctrlKey) && !e.altKey && (e.key?.toLowerCase() === "k" || e.code === "KeyK")) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // A fresh launcher every time it opens — before paint, so the last search never flashes.
  useLayoutEffect(() => {
    if (!open) return;
    setQuery("");
    setResults(EMPTY);
    setSearching(false);
    setFailed(false);
    setActiveAt({ list: "", index: 0 });
    lastPoint.current = null;
    setRecents(readSpotlightRecents(workspaceId));
    setDark(document.documentElement.classList.contains("dark"));
  }, [open, workspaceId]);

  useEffect(() => {
    if (!open) return;
    const viewport = window.visualViewport;
    if (!viewport) return;
    const sync = () => setViewportHeight(Math.round(viewport.height));
    sync();
    viewport.addEventListener("resize", sync);
    return () => viewport.removeEventListener("resize", sync);
  }, [open]);

  const term = query.trim();
  useEffect(() => {
    // Closed: what is on screen stays as it is while the pane fades out (opening starts fresh).
    if (!open) return;
    if (!workspaceId || term.length < 2) {
      setResults(EMPTY);
      setSearching(false);
      setFailed(false);
      return;
    }
    const controller = new AbortController();
    setSearching(true);
    setFailed(false);
    const id = window.setTimeout(() => {
      dashboardSearch(apiClient, workspaceId, term, controller.signal)
        .then((found) => {
          if (controller.signal.aborted) return;
          setResults(found);
          setSearching(false);
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setResults(EMPTY);
            setSearching(false);
            // A failure is not "nothing found": say so (audit U-33).
            setFailed(true);
          }
        });
    }, 200);
    return () => {
      controller.abort();
      window.clearTimeout(id);
    };
  }, [open, workspaceId, term, attempt]);

  const actions = useMemo<ActionEntry[]>(() => {
    const goTo = (id: string, icon: IconComponent, label: string, to: string): ActionEntry => ({
      id,
      section: "action",
      icon,
      title: label,
      label,
      to,
      recent: { id, group: "action", title: label, to, icon: id },
    });
    const list: ActionEntry[] = [
      goTo("cmd-order", IconPlus, t.cmdNewOrder, "/orders/new"),
      goTo("cmd-product", IconProduct, t.cmdNewProduct, "/catalog/new"),
      goTo("cmd-confirm", IconConfirm, t.cmdConfirm, "/confirmation-queue"),
      goTo("cmd-orders", IconOrders, t.cmdOrders, "/orders"),
      goTo("cmd-discount", IconPercent, t.cmdNewDiscount, "/discounts"),
      goTo("cmd-stores", IconStore, t.cmdAllStores, "/stores"),
      goTo("cmd-forms", IconTray, t.cmdForms, "/form-submissions"),
      goTo("cmd-segments", IconContacts, t.cmdSegments, "/customers?tab=segments"),
    ];
    if (slug) {
      list.push({
        id: "cmd-store",
        section: "action",
        icon: IconExternal,
        title: t.cmdOpenStore,
        label: t.cmdOpenStore,
        words: t.wordsStore,
        detail: <bdi dir="ltr">{storeHost(slug)}</bdi>,
        run: () => {
          window.open(storeUrl(slug), "_blank", "noopener,noreferrer");
        },
      });
    }
    list.push(
      {
        id: "cmd-theme",
        section: "action",
        icon: dark ? IconSun : IconMoon,
        title: t.cmdTheme,
        label: t.cmdTheme,
        words: t.wordsTheme,
        detail: dark ? t.themeToLight : t.themeToDark,
        verb: "run",
        run: switchTheme,
      },
      {
        id: "cmd-language",
        section: "action",
        icon: IconLanguage,
        title: t.cmdLanguage,
        label: t.cmdLanguage,
        words: t.wordsLanguage,
        detail: <span lang={locale === "ar" ? "en" : "ar"}>{t.languageTo}</span>,
        verb: "run",
        run: toggleLocale,
      },
      {
        id: "cmd-shortcuts",
        section: "action",
        icon: IconKeyboard,
        title: t.cmdShortcuts,
        label: t.cmdShortcuts,
        words: t.wordsShortcuts,
        run: () => {
          window.dispatchEvent(new Event(SHORTCUTS_HELP_EVENT));
        },
      }
    );
    // An action that opens a page this role does not have is not offered (the side menu's own rule).
    return list.filter((action) => {
      if (action.to === undefined) return true;
      const item = findNavItem(pathOf(action.to));
      return !item || isNavItemVisible(item, role);
    });
  }, [t, slug, dark, locale, toggleLocale, role]);

  const { sections, entries, entriesKey } = useMemo(() => {
    const needle = foldForSearch(term);
    const matches = (label: string) => foldForSearch(label).includes(needle);
    const kindLabels: Record<RecordKind, string> = {
      order: t.kindOrder,
      product: t.kindProduct,
      customer: t.kindCustomer,
      funnel: t.kindFunnel,
    };

    const pageEntry = (item: NavItem): Entry => {
      const id = `page-${item.to}`;
      const label = navLabels[item.key];
      const groupKey = findNavGroup(item)?.labelKey;
      return {
        id,
        section: "page",
        icon: item.icon,
        title: label,
        detail: groupKey ? groupLabels[groupKey] : undefined,
        to: item.to,
        recent: { id, group: "page", title: label, to: item.to, icon: item.key },
      };
    };
    const visiblePages = NAV_ITEMS.filter((item) => isNavItemVisible(item, role));

    const built: SectionModel[] = [];
    const add = (key: Section, heading: string, list: Entry[], counted = false) => {
      if (list.length > 0) built.push({ key, heading, count: counted ? list.length : undefined, start: 0, entries: list });
    };

    if (needle === "") {
      // A launcher: where you were, what you do most, where you can go.
      const recentEntries: Entry[] = [];
      recents.forEach((recent, position) => {
        const id = `recent-${position}-${recent.id}`;
        if (recent.group === "action") {
          // In today's language, and only while the action still exists for this role.
          const live = actions.find((action) => action.id === recent.id);
          const to = live?.to;
          if (!live || to === undefined) return;
          recentEntries.push({ id, section: "recent", icon: live.icon, title: live.title, detail: t.kindAction, to, recent: live.recent });
          return;
        }
        const owner = findNavItem(pathOf(recent.to));
        if (owner && !isNavItemVisible(owner, role)) return;
        if (recent.group === "page") {
          const page = NAV_ITEMS.find((item) => item.to === recent.to);
          if (!page) return;
          recentEntries.push({ ...pageEntry(page), id, section: "recent", detail: t.kindPage });
          return;
        }
        const kind = kindLabels[recent.group];
        const named = recent.title !== "";
        recentEntries.push({
          id,
          section: "recent",
          icon: KIND_ICONS[recent.group],
          title: !named ? kind : recent.group === "order" ? <bdi dir="ltr">{recent.title}</bdi> : <bdi>{recent.title}</bdi>,
          detail: recent.detail ? <span dir="auto">{recent.detail}</span> : named ? kind : undefined,
          to: recent.to,
          recent,
        });
      });
      add("recent", t.recents, recentEntries);
      add("action", t.commands, actions);
      // A page an action already opens is listed once, as the action.
      const taken = new Set(actions.map((action) => action.to));
      add(
        "page",
        t.pages,
        visiblePages
          .filter((item) => !taken.has(item.to))
          .slice(0, PAGES_AT_REST)
          .map(pageEntry)
      );
    } else {
      add(
        "order",
        t.orders,
        results.orders.map((order): Entry => {
          const id = `order-${order.id}`;
          const to = `/orders/${order.id}`;
          const name = order.customerName?.trim() ?? "";
          const total = formatMoney(order.totalAmount, order.currency);
          return {
            id,
            section: "order",
            icon: IconOrders,
            title: <bdi dir="ltr">{order.orderNumber}</bdi>,
            detail: name ? (
              <>
                <bdi>{name}</bdi> · <bdi>{total}</bdi>
              </>
            ) : (
              <bdi>{total}</bdi>
            ),
            to,
            recent: {
              id,
              group: "order",
              title: order.orderNumber,
              detail: name && !looksLikePhone(name) ? `${name} · ${total}` : total,
              to,
              icon: "order",
            },
          };
        }),
        true
      );
      add(
        "product",
        t.products,
        results.products.map((product): Entry => {
          const id = `product-${product.id}`;
          const to = `/catalog/${product.id}`;
          const code = formatProductCode(product.productCode);
          // A product that is not on sale says so; a live one needs no label.
          const state = product.status && product.status !== "active" ? humanize(product.status) : null;
          return {
            id,
            section: "product",
            icon: IconProducts,
            image: thumbSrc(product.imageUrl),
            title: <bdi>{product.name}</bdi>,
            detail:
              code || state ? (
                <>
                  {code && <bdi dir="ltr">{code}</bdi>}
                  {code && state && " · "}
                  {state}
                </>
              ) : undefined,
            to,
            recent: { id, group: "product", title: product.name, detail: code ?? undefined, to, icon: "product" },
          };
        }),
        true
      );
      add(
        "customer",
        t.customers,
        results.customers.map((customer): Entry => {
          const id = `customer-${customer.id}`;
          const to = `/customers/${customer.id}`;
          const name = customer.fullName?.trim() ?? "";
          const orders = countOf("order", customer.totalOrders);
          return {
            id,
            section: "customer",
            icon: IconUser,
            title: name ? <bdi>{name}</bdi> : <bdi dir="ltr">{customer.phone}</bdi>,
            detail: name ? (
              <>
                <bdi dir="ltr">{customer.phone}</bdi> · {orders}
              </>
            ) : (
              orders
            ),
            to,
            contact: { phone: customer.phone, name },
            // The name only — a phone number is never kept (lib/spotlightRecents.ts).
            recent: { id, group: "customer", title: name, to, icon: "customer" },
          };
        }),
        true
      );
      add(
        "funnel",
        t.funnels,
        results.funnels.map((funnel): Entry => {
          const id = `funnel-${funnel.id}`;
          const to = `/funnels/${funnel.id}`;
          return {
            id,
            section: "funnel",
            icon: IconFunnels,
            title: <bdi>{funnel.name}</bdi>,
            to,
            recent: { id, group: "funnel", title: funnel.name, to, icon: "funnel" },
          };
        }),
        true
      );

      const found = actions.filter(
        (action) =>
          matches(action.label) ||
          (action.words !== undefined && matches(action.words)) ||
          (action.to !== undefined && action.to.includes(needle))
      );
      add("action", t.commands, found);
      const taken = new Set(found.map((action) => action.to));
      add(
        "page",
        t.pages,
        visiblePages
          .filter((item) => !taken.has(item.to))
          .filter((item) => matches(navLabels[item.key]) || item.to.includes(needle))
          .map(pageEntry)
      );
    }

    let start = 0;
    for (const section of built) {
      section.start = start;
      start += section.entries.length;
    }
    const flat = built.flatMap((section) => section.entries);
    return { sections: built, entries: flat, entriesKey: flat.map((entry) => entry.id).join("\n") };
  }, [term, results, recents, actions, t, navLabels, groupLabels, role]);

  // A new list starts at its first row — in the same render, so Enter never lands on a stale row —
  // and scrolled to the top.
  const activeIndex = activeAt.list === entriesKey ? Math.min(activeAt.index, Math.max(entries.length - 1, 0)) : 0;
  const activeEntry: Entry | undefined = entries[activeIndex];
  const setActive = (index: number) => setActiveAt({ list: entriesKey, index });
  useLayoutEffect(() => {
    if (scrollerRef.current) scrollerRef.current.scrollTop = 0;
  }, [entriesKey]);

  useEffect(() => {
    if (!open || !followActive.current) return;
    followActive.current = false;
    const scroller = scrollerRef.current;
    if (!scroller) return;
    if (activeIndex === 0) {
      // Back to the very top, so the first heading shows too.
      scroller.scrollTop = 0;
      return;
    }
    scroller.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);

  // The page behind the active row is fetched while the eye is still on it.
  const activeTo = activeEntry?.to;
  useEffect(() => {
    if (open && activeTo !== undefined) prefetchRoute(activeTo);
  }, [open, activeTo]);

  function close() {
    setOpen(false);
  }

  function openEntry(entry: Entry | undefined) {
    if (!entry) return;
    setOpen(false);
    if (entry.recent) rememberSpotlightRecent(workspaceId, entry.recent);
    if (entry.to !== undefined) navigate(entry.to);
    else entry.run?.();
  }

  function move(index: number) {
    if (index === activeIndex) return;
    followActive.current = true;
    setActive(index);
  }

  function onKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    if (e.nativeEvent.isComposing) return;
    const count = entries.length;
    const plain = !e.shiftKey && !e.altKey && !e.ctrlKey && !e.metaKey;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      move(count > 0 ? (activeIndex + 1) % count : 0);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      move(count > 0 ? (activeIndex - 1 + count) % count : 0);
    } else if (e.key === "Home" && plain) {
      e.preventDefault();
      move(0);
    } else if (e.key === "End" && plain) {
      e.preventDefault();
      move(Math.max(count - 1, 0));
    } else if (e.key === "Enter") {
      // Enter on the clear button or on a call / WhatsApp link is that control's own.
      const target = e.target as HTMLElement;
      if (target !== inputRef.current && target.closest("a, button")) return;
      e.preventDefault();
      openEntry(activeEntry);
    }
    // Esc: the dialog closes itself.
  }

  /**
   * The row under a pointer that moved becomes the active one. A list that
   * changes under a still pointer (typing) must not: browsers send a move
   * event for that too, at the same spot — so the first event after opening
   * only records where the pointer is, and one at an unchanged spot is ignored.
   */
  function pointAtRow(e: ReactMouseEvent<HTMLDivElement>) {
    const last = lastPoint.current;
    lastPoint.current = { x: e.clientX, y: e.clientY };
    if (!last || (last.x === e.clientX && last.y === e.clientY)) return;
    const row = (e.target as HTMLElement).closest<HTMLElement>("[data-index]");
    if (!row) return;
    const index = Number(row.dataset.index);
    if (Number.isInteger(index) && index !== activeIndex) setActive(index);
  }

  /** A click on a row or on the list's own space leaves the caret in the field. */
  function keepFocusInField(e: ReactMouseEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement;
    if (target === e.currentTarget || target.closest("a, button")) return;
    e.preventDefault();
  }

  function clearQuery() {
    setQuery("");
    inputRef.current?.focus();
  }

  function forgetRecents() {
    clearSpotlightRecents(workspaceId);
    setRecents([]);
    inputRef.current?.focus();
  }

  // Said to a screen reader once the list settles; a failure has its own alert.
  const status = !open
    ? ""
    : searching
      ? t.searching
      : term !== "" && !failed
        ? entries.length > 0
          ? pluralOf(t, "hits", entries.length)
          : fmt(t.nothing, { q: term })
        : "";

  return (
    <>
      <button
        type="button"
        data-slot="spotlight-trigger"
        onClick={() => setOpen(true)}
        aria-label={t.open}
        aria-keyshortcuts="Control+K Meta+K"
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          "zimos-spotlight-trigger flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-paper-raised text-ink-soft ring-1 ring-line",
          "transition-[background-color,color,box-shadow,translate,scale] duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-reduce:transition-none",
          "hover:bg-paper-sunken hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-safe:active:scale-[0.97]",
          // A round button below lg (36px for a mouse), a search field from lg up.
          "pointer-fine:max-lg:size-9",
          "lg:h-9 lg:w-[16.25rem] lg:justify-start lg:gap-2 lg:ps-3 lg:pe-1.5 motion-safe:lg:hover:-translate-y-0.5 lg:pointer-coarse:h-11"
        )}
      >
        <IconSearch className="size-5 shrink-0 lg:size-4" aria-hidden />
        <span className="hidden min-w-0 flex-1 truncate text-start text-sm lg:block">{t.placeholder}</span>
        <kbd
          dir="ltr"
          data-slot="spotlight-keycap"
          className="hidden h-6 shrink-0 items-center rounded-full bg-paper-sunken px-2 font-sans text-[11px] leading-none font-medium text-ink-soft ring-1 ring-line lg:inline-flex"
        >
          {isMac ? "⌘K" : "Ctrl K"}
        </kbd>
      </button>

      {/* Base UI's Dialog: focus is held inside and handed back, the page behind does not scroll,
          Esc and a press outside close it. Mounted on <body>, outside the glass frame. */}
      <DialogPrimitive.Root open={open} onOpenChange={(next) => setOpen(next)}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Backdrop
            data-slot="spotlight-backdrop"
            className="fixed inset-0 z-50 bg-black/25 transition-opacity duration-[var(--dur-fade)] ease-[var(--ease-out)] data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 motion-reduce:transition-none dark:bg-black/55"
          />
          <DialogPrimitive.Viewport className="fixed inset-0 z-50 flex items-start justify-center sm:px-4 sm:pt-[14vh]">
            <DialogPrimitive.Popup
              data-slot="spotlight"
              // Always the field — on a touch screen too: this is a search, the keyboard should come up.
              initialFocus={inputRef}
              onKeyDown={onKeyDown}
              style={viewportHeight ? ({ "--spotlight-vh": `${viewportHeight}px` } as CSSProperties) : undefined}
              className={cn(
                "zimos-spotlight flex w-full origin-top flex-col overflow-hidden bg-paper-raised text-ink outline-none",
                // Phone: the whole screen above the keyboard, anchored to the top.
                "h-[var(--spotlight-vh,100dvh)] pt-[env(safe-area-inset-top)]",
                // From sm: a pane 640px wide, as tall as its list, at most 70vh.
                "sm:h-auto sm:max-h-[70vh] sm:max-w-[40rem] sm:rounded-[1.5rem] sm:pt-0 sm:shadow-[var(--shadow-pop)] sm:ring-1 sm:ring-line",
                "transition-[opacity,scale] duration-[var(--dur-move)] ease-[var(--ease-spring)] motion-reduce:transition-none",
                "data-[starting-style]:scale-[0.97] data-[starting-style]:opacity-0",
                "data-[ending-style]:scale-[0.97] data-[ending-style]:opacity-0 data-[ending-style]:duration-[var(--dur-fade)] data-[ending-style]:ease-[var(--ease-out)]"
              )}
            >
              <DialogPrimitive.Title className="sr-only">{t.open}</DialogPrimitive.Title>

              <div data-slot="spotlight-head" className="flex h-14 shrink-0 items-center gap-1 border-b border-line px-3 sm:px-0">
                {/* On a phone the field is a pill with «إلغاء» beside it; from sm it is the pane's own first line. */}
                <div
                  data-slot="spotlight-field"
                  className={cn(
                    "flex h-11 min-w-0 flex-1 items-center gap-2.5 rounded-full bg-paper-sunken ps-3.5 sm:h-full sm:gap-3 sm:rounded-none sm:bg-transparent sm:ps-5 sm:pe-1.5",
                    query ? "pe-0" : "pe-3.5"
                  )}
                >
                  <IconSearch className="size-5 shrink-0 text-ink-soft" aria-hidden />
                  <input
                    ref={inputRef}
                    type="text"
                    inputMode="search"
                    enterKeyHint="search"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    role="combobox"
                    aria-expanded={entries.length > 0}
                    aria-controls={listId}
                    aria-autocomplete="list"
                    aria-activedescendant={activeEntry ? `${baseId}-opt-${activeIndex}` : undefined}
                    aria-label={t.open}
                    placeholder={t.placeholder}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    maxLength={100}
                    // 16px: iOS Safari zooms the page into a smaller field.
                    className="h-full min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-ink-soft"
                  />
                  {/* Shown only when the answer takes a moment, so quick typing never flickers it. */}
                  <IconSpinner
                    aria-hidden
                    className={cn(
                      "size-4 shrink-0 text-ink-soft transition-opacity duration-150 motion-reduce:transition-none",
                      searching ? "animate-spin opacity-100 delay-300 motion-reduce:animate-none" : "opacity-0"
                    )}
                  />
                  {/* Clears what was typed; with nothing typed it closes (a phone has «إلغاء» for that). */}
                  <button
                    type="button"
                    onClick={query ? clearQuery : close}
                    aria-label={query ? t.clear : t.close}
                    className={cn(
                      "group/x flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-primary",
                      !query && "max-sm:hidden"
                    )}
                  >
                    <span className="flex size-6 items-center justify-center rounded-full bg-ink/10 text-ink-soft transition-colors duration-[var(--dur-fade)] group-hover/x:bg-ink/15 group-hover/x:text-ink motion-safe:group-active/x:scale-[0.97] motion-reduce:transition-none">
                      <IconClose className="size-3.5" weight="bold" aria-hidden />
                    </span>
                  </button>
                </div>
                <button
                  type="button"
                  onClick={close}
                  className="flex h-11 shrink-0 cursor-pointer items-center rounded-full px-2.5 text-[15px] font-medium text-primary focus-visible:outline-2 focus-visible:outline-primary motion-safe:active:scale-[0.97] sm:hidden"
                >
                  {t.cancel}
                </button>
              </div>

              {failed && (
                <div
                  role="alert"
                  data-slot="spotlight-notice"
                  className="mx-2 mt-2 flex shrink-0 items-center gap-2.5 rounded-[1rem] bg-accent-soft py-1 ps-3 pe-1 text-sm text-accent-dark"
                >
                  <IconWarning className="size-4 shrink-0" aria-hidden />
                  <span className="min-w-0 flex-1 py-1.5">{t.failed}</span>
                  <button
                    type="button"
                    onClick={() => setAttempt((n) => n + 1)}
                    className="flex min-h-11 shrink-0 cursor-pointer items-center rounded-full px-3 text-sm font-semibold hover:underline focus-visible:outline-2 focus-visible:outline-primary motion-safe:active:scale-[0.97]"
                  >
                    {t.retry}
                  </button>
                </div>
              )}

              <div
                ref={scrollerRef}
                onMouseDown={keepFocusInField}
                onMouseMove={pointAtRow}
                className="shell-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-2 max-sm:pb-[max(0.5rem,env(safe-area-inset-bottom))]"
              >
                <div id={listId} role="listbox" aria-label={t.open}>
                  {sections.map((section) => {
                    const headingId = `${baseId}-h-${section.key}`;
                    return (
                      <div key={section.key} role="group" aria-labelledby={headingId} className="pt-1.5">
                        <div className="flex h-7 items-center gap-2 px-3">
                          <span id={headingId} className="min-w-0 flex-1 truncate text-[11px] font-semibold text-ink-soft">
                            {section.heading}
                            {section.count !== undefined && <span className="font-normal"> · {pluralOf(t, "hits", section.count)}</span>}
                          </span>
                          {section.key === "recent" && (
                            <button
                              type="button"
                              onClick={forgetRecents}
                              aria-label={t.clearRecentsLabel}
                              className="relative shrink-0 cursor-pointer rounded-full px-1.5 text-[11px] font-semibold text-ink-soft before:absolute before:-inset-x-2 before:-inset-y-3.5 hover:text-ink focus-visible:outline-2 focus-visible:outline-primary"
                            >
                              {t.clearRecents}
                            </button>
                          )}
                        </div>
                        {section.entries.map((entry, offset) => {
                          const index = section.start + offset;
                          const isActive = index === activeIndex;
                          const who = entry.contact ? entry.contact.name || entry.contact.phone : "";
                          return (
                            <SpotlightRow
                              key={entry.id}
                              entry={entry}
                              index={index}
                              active={isActive}
                              optionId={`${baseId}-opt-${index}`}
                              verb={entry.verb === "run" ? t.verbRun : t.verbOpen}
                              callLabel={fmt(t.callName, { name: who })}
                              whatsappLabel={fmt(t.whatsappName, { name: who })}
                              onOpen={() => openEntry(entry)}
                            />
                          );
                        })}
                      </div>
                    );
                  })}
                </div>

                {entries.length === 0 && !failed && (
                  <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
                    {searching ? (
                      <IconSpinner className="size-6 animate-spin text-ink-soft motion-reduce:animate-none" aria-hidden />
                    ) : (
                      <IconSearch className="size-10 text-ink-soft" weight="duotone" aria-hidden />
                    )}
                    <p className="text-sm font-medium text-ink">{searching ? t.searching : fmt(t.nothing, { q: term })}</p>
                    {!searching && <p className="max-w-xs text-xs leading-5 text-ink-soft">{t.hint}</p>}
                  </div>
                )}
              </div>

              <p role="status" aria-live="polite" className="sr-only">
                {status}
              </p>

              {/* Key hints mean nothing on a touch screen (re-audit N-22). */}
              <div
                aria-hidden
                data-slot="spotlight-footer"
                className="flex h-10 shrink-0 items-center gap-4 border-t border-line px-4 text-xs text-ink-soft pointer-coarse:hidden"
              >
                <span className="flex items-center gap-1.5">
                  <Keycap>
                    <IconArrowUp className="size-3" weight="bold" />
                  </Keycap>
                  <Keycap>
                    <IconArrowDown className="size-3" weight="bold" />
                  </Keycap>
                  {t.keysMove}
                </span>
                <span className="flex items-center gap-1.5">
                  <Keycap>
                    <IconEnter className="size-3.5" />
                  </Keycap>
                  {t.keysOpen}
                </span>
                <span className="flex items-center gap-1.5">
                  <Keycap>esc</Keycap>
                  {t.keysClose}
                </span>
              </div>
            </DialogPrimitive.Popup>
          </DialogPrimitive.Viewport>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}

/** A key, drawn as a key. Its legend is the key's own, so it reads left to right in both languages. */
function Keycap({ children }: { children: ReactNode }) {
  return (
    <kbd
      dir="ltr"
      data-slot="spotlight-keycap"
      className="inline-flex h-5 min-w-5 items-center justify-center rounded-[6px] bg-paper-sunken px-1 font-sans text-[11px] leading-none font-medium text-ink-soft ring-1 ring-line"
    >
      {children}
    </kbd>
  );
}

/** The 32px chip at the start of a row: the icon on a soft brand tint, or the product's photo. */
function Chip({ entry, active }: { entry: Entry; active: boolean }) {
  const [broken, setBroken] = useState(false);
  const Glyph = entry.icon;
  const photo = entry.image && !broken ? entry.image : null;
  return (
    <span
      data-slot="spotlight-chip"
      className={cn(
        "flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-[10px]",
        active ? "bg-primary text-primary-foreground" : "bg-primary-soft text-primary-dark"
      )}
    >
      {photo ? (
        <img src={photo} alt="" loading="lazy" decoding="async" draggable={false} onError={() => setBroken(true)} className="size-full object-cover" />
      ) : (
        <Glyph className="size-[18px]" weight={active ? "fill" : "regular"} aria-hidden />
      )}
    </span>
  );
}

/**
 * One result. The option itself is the wide part (chip, title, detail, what
 * Enter does); a customer's call and WhatsApp buttons sit beside it — inside
 * the same pill, outside the option — so a tap on them never opens the row and
 * Tab reaches them.
 */
function SpotlightRow({
  entry,
  index,
  active,
  optionId,
  verb,
  callLabel,
  whatsappLabel,
  onOpen,
}: {
  entry: Entry;
  index: number;
  active: boolean;
  optionId: string;
  verb: string;
  callLabel: string;
  whatsappLabel: string;
  onOpen: () => void;
}) {
  const whatsapp = entry.contact ? toWhatsAppNumber(entry.contact.phone) : null;
  // 36px to the eye, 44px to the thumb (the ::before), 8px apart.
  const contactButton =
    "relative flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-paper-raised ring-1 ring-line transition-[background-color,color,scale] duration-[var(--dur-fade)] ease-[var(--ease-out)] before:absolute before:-inset-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-safe:active:scale-[0.97] motion-reduce:transition-none";
  return (
    <div
      role="presentation"
      data-slot="spotlight-row"
      data-index={index}
      data-active={active ? "" : undefined}
      className={cn(
        "flex min-h-12 scroll-my-1 items-center rounded-full text-ink forced-colors:-outline-offset-2",
        active && "bg-primary-soft forced-colors:outline-2 forced-colors:outline-[color:Highlight]"
      )}
    >
      <div
        role="option"
        id={optionId}
        aria-selected={active}
        onClick={onOpen}
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 self-stretch py-1.5 ps-2 pe-4 text-start"
      >
        <Chip entry={entry} active={active} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm leading-5 font-medium">{entry.title}</span>
          {entry.detail && <span className="block truncate text-xs leading-4 text-ink-soft">{entry.detail}</span>}
        </span>
        {/* What Enter does, on the row it applies to. A touch screen has no Enter to point at. */}
        {active && (
          <span
            data-slot="spotlight-verb"
            aria-hidden
            className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-primary-dark pointer-coarse:hidden"
          >
            {verb}
            <IconEnter className="size-4" />
          </span>
        )}
      </div>
      {entry.contact && (
        <span className="flex shrink-0 items-center gap-2 pe-1.5">
          <a
            href={telHref(entry.contact.phone)}
            onClick={(e) => e.stopPropagation()}
            aria-label={callLabel}
            data-slot="spotlight-contact"
            className={cn(contactButton, "text-primary-dark hover:bg-primary hover:text-primary-foreground")}
          >
            <IconPhone className="size-4" aria-hidden />
          </a>
          {whatsapp && (
            <a
              href={`https://wa.me/${whatsapp}`}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              aria-label={whatsappLabel}
              data-slot="spotlight-contact"
              className={cn(contactButton, "text-success hover:bg-success hover:text-paper-raised")}
            >
              <IconWhatsApp className="size-4" aria-hidden />
            </a>
          )}
        </span>
      )}
    </div>
  );
}
