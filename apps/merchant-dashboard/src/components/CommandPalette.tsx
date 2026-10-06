import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { CornerDownLeft, Package, Plus, Search, ShoppingBag, Users, Workflow, X, type LucideIcon } from "lucide-react";
import { cn } from "@store-builder/ui";
import { dashboardSearch, type DashboardSearchResult } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspace } from "@/context/WorkspaceContext";
import { NAV_ITEMS, NAV_LABELS, isNavItemVisible } from "@/lib/navigation";
import { formatMoney } from "@/lib/format";
import { useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    open: "Search",
    placeholder: "Search orders, products, customers, pages…",
    hint: "Type an order number, a phone, a name — or the page you want.",
    searching: "Searching…",
    nothing: "Nothing matches “{q}”.",
    pages: "Pages",
    commands: "Actions",
    orders: "Orders",
    products: "Products",
    customers: "Customers",
    funnels: "Funnels",
    cmdNewProduct: "New product",
    cmdNewOrder: "New order",
    cmdOrders: "All orders",
    cmdConfirm: "Confirm orders",
    cmdNewDiscount: "Discounts",
    failed: "Search isn't working right now. Check your connection and try again.",
    cmdAllStores: "All my stores",
    cmdForms: "Form submissions",
    cmdSegments: "Contact segments",
    ordersCount: "{n} orders",
    toSelect: "to open",
    close: "Close search",
  },
  ar: {
    open: "بحث",
    placeholder: "دوّر في الأوردرات والمنتجات والعملاء والصفحات…",
    hint: "اكتب رقم أوردر، موبايل (أو آخر ٤ أرقام)، اسم — أو الصفحة اللي عايزها.",
    searching: "بندوّر…",
    nothing: "مفيش نتايج لـ «{q}».",
    pages: "الصفحات",
    commands: "اعمل بسرعة",
    orders: "الأوردرات",
    products: "المنتجات",
    customers: "العملاء",
    funnels: "مسارات البيع",
    cmdNewProduct: "ضيف منتج",
    cmdNewOrder: "أوردر جديد",
    cmdOrders: "كل الأوردرات",
    cmdConfirm: "تأكيد الأوردرات",
    cmdNewDiscount: "الخصومات",
    cmdAllStores: "كل متاجري",
    cmdForms: "رسايل الفورم",
    cmdSegments: "شرايح جهات الاتصال",
    ordersCount: "{n} أوردر",
    toSelect: "للفتح",
    close: "اقفل البحث",
    failed: "البحث مش شغال دلوقتي. اتأكد من النت وجرّب تاني.",
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
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .trim();
}

interface Entry {
  id: string;
  group: string;
  icon: LucideIcon;
  title: ReactNode;
  detail?: ReactNode;
  to: string;
}

const EMPTY: DashboardSearchResult = { orders: [], products: [], customers: [], funnels: [] };
const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

/**
 * Global search (SPEC §18.6): ⌘K / Ctrl+K from anywhere in the dashboard.
 * Records come from GET /search; pages and actions are matched here, in the
 * language the dashboard is shown in.
 */
export function CommandPalette() {
  const t = useT(STRINGS);
  const navLabels = useT(NAV_LABELS);
  const navigate = useNavigate();
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id;
  const role = currentWorkspace?.role;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DashboardSearchResult>(EMPTY);
  const [searching, setSearching] = useState(false);
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setResults(EMPTY);
    setActive(0);
    // After the dialog is in the DOM.
    const id = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [open]);

  const term = query.trim();
  useEffect(() => {
    if (!open || !workspaceId || term.length < 2) {
      setResults(EMPTY);
      setSearching(false);
      return;
    }
    const controller = new AbortController();
    setSearching(true);
    setFailed(false);
    const id = window.setTimeout(() => {
      dashboardSearch(apiClient, workspaceId, term, controller.signal)
        .then((found) => {
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
  }, [open, workspaceId, term]);

  const entries = useMemo<Entry[]>(() => {
    const needle = foldForSearch(term);
    const matches = (label: string) => needle === "" || foldForSearch(label).includes(needle);

    const commands: Entry[] = [
      { id: "cmd-order", group: t.commands, icon: Plus, title: t.cmdNewOrder, to: "/orders/new" },
      { id: "cmd-product", group: t.commands, icon: Plus, title: t.cmdNewProduct, to: "/catalog/new" },
      { id: "cmd-confirm", group: t.commands, icon: ShoppingBag, title: t.cmdConfirm, to: "/confirmation-queue" },
      { id: "cmd-orders", group: t.commands, icon: ShoppingBag, title: t.cmdOrders, to: "/orders" },
      { id: "cmd-discount", group: t.commands, icon: Search, title: t.cmdNewDiscount, to: "/discounts" },
      { id: "cmd-stores", group: t.commands, icon: Search, title: t.cmdAllStores, to: "/stores" },
      { id: "cmd-forms", group: t.commands, icon: Search, title: t.cmdForms, to: "/form-submissions" },
      { id: "cmd-segments", group: t.commands, icon: Users, title: t.cmdSegments, to: "/customers?tab=segments" },
    ].filter((c) => matches(String(c.title)));

    // A page an action already opens is listed once, as the action.
    const commandTargets = new Set(commands.map((c) => c.to));
    const pages: Entry[] = NAV_ITEMS.filter((item) => isNavItemVisible(item, role) && !commandTargets.has(item.to))
      .filter((item) => matches(navLabels[item.key]) || (needle !== "" && item.to.includes(needle)))
      .map((item) => ({ id: `page-${item.to}`, group: t.pages, icon: item.icon, title: navLabels[item.key], to: item.to }));

    const records: Entry[] = [
      ...results.orders.map((o) => ({
        id: `order-${o.id}`,
        group: t.orders,
        icon: ShoppingBag,
        title: <bdi dir="ltr">{o.orderNumber}</bdi>,
        detail: (
          <>
            <bdi>{o.customerName}</bdi> · {formatMoney(o.totalAmount, o.currency)}
          </>
        ),
        to: `/orders/${o.id}`,
      })),
      ...results.products.map((p) => ({
        id: `product-${p.id}`,
        group: t.products,
        icon: Package,
        title: <bdi>{p.name}</bdi>,
        detail: p.productCode ? <bdi dir="ltr">#{p.productCode}</bdi> : undefined,
        to: `/catalog/${p.id}`,
      })),
      ...results.customers.map((c) => ({
        id: `customer-${c.id}`,
        group: t.customers,
        icon: Users,
        title: <bdi>{c.fullName || c.phone}</bdi>,
        detail: (
          <>
            <bdi dir="ltr">{c.phone}</bdi> · {t.ordersCount.replace("{n}", String(c.totalOrders))}
          </>
        ),
        to: `/customers/${c.id}`,
      })),
      ...results.funnels.map((f) => ({ id: `funnel-${f.id}`, group: t.funnels, icon: Workflow, title: <bdi>{f.name}</bdi>, to: `/funnels/${f.id}` })),
    ];

    // With nothing typed the palette is a launcher: actions first, then pages.
    return needle === "" ? [...commands, ...pages.slice(0, 8)] : [...records, ...commands, ...pages];
  }, [term, results, t, navLabels, role]);

  useEffect(() => {
    setActive(0);
  }, [entries.length, term]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function go(entry: Entry | undefined) {
    if (!entry) return;
    setOpen(false);
    navigate(entry.to);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (entries.length ? (i + 1) % entries.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (entries.length ? (i - 1 + entries.length) % entries.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(entries[active]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t.open}
        aria-keyshortcuts="Control+K Meta+K"
        className="flex min-h-9 cursor-pointer items-center gap-2 rounded-[0.5rem] border border-line bg-paper px-2.5 text-sm text-ink-soft hover:border-primary/40 hover:text-ink"
      >
        <Search className="size-4" aria-hidden />
        <span className="hidden lg:inline">{t.open}</span>
        <kbd dir="ltr" className="hidden rounded border border-line bg-paper-raised px-1.5 text-[11px] font-medium lg:inline">
          {isMac ? "⌘K" : "Ctrl K"}
        </kbd>
      </button>

      {/* Mounted on <body>: the trigger sits in the dark top bar, the palette follows the page theme. */}
      {open && createPortal(
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-ink/40 p-4 pt-[12vh]" onMouseDown={() => setOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t.open}
            onMouseDown={(e) => e.stopPropagation()}
            onKeyDown={onKeyDown}
            className="flex max-h-[70vh] w-full max-w-xl flex-col overflow-hidden rounded-[var(--radius-card)] bg-paper-raised shadow-[var(--shadow-pop)] ring-1 ring-line"
          >
            <div className="flex items-center gap-3 border-b border-line px-4">
              <Search className="size-4 shrink-0 text-ink-soft" aria-hidden />
              <input
                ref={inputRef}
                autoFocus
                type="search"
                role="combobox"
                aria-expanded="true"
                aria-controls="command-palette-list"
                aria-activedescendant={entries[active] ? `cp-${entries[active].id}` : undefined}
                aria-label={t.open}
                placeholder={t.placeholder}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                maxLength={100}
                className="min-h-12 w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-soft"
              />
              {/* Touch screens have no Esc key. */}
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t.close}
                className="-me-2 flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-soft hover:bg-paper-sunken hover:text-ink"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>

            <div ref={listRef} id="command-palette-list" role="listbox" aria-label={t.open} className="flex-1 overflow-y-auto p-2">
              {entries.length === 0 ? (
                <p role="status" className="px-3 py-8 text-center text-sm text-ink-soft">
                  {searching ? t.searching : failed ? t.failed : term ? t.nothing.replace("{q}", term) : t.hint}
                </p>
              ) : (
                entries.map((entry, index) => {
                  const heading = index === 0 || entries[index - 1].group !== entry.group ? entry.group : null;
                  return (
                    <div key={entry.id}>
                      {heading && <p className="px-3 pt-2 pb-1 text-[11px] font-semibold tracking-wider text-ink-soft uppercase rtl:tracking-normal">{heading}</p>}
                      <button
                        type="button"
                        id={`cp-${entry.id}`}
                        role="option"
                        aria-selected={index === active}
                        data-index={index}
                        onMouseMove={() => setActive(index)}
                        onClick={() => go(entry)}
                        className={cn(
                          "flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-[var(--radius)] px-3 py-2 text-start text-sm text-ink",
                          index === active && "bg-primary-soft text-primary-dark"
                        )}
                      >
                        <entry.icon className="size-4 shrink-0 text-ink-soft" aria-hidden />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{entry.title}</span>
                          {entry.detail && <span className="block truncate text-xs text-ink-soft">{entry.detail}</span>}
                        </span>
                        {index === active && <CornerDownLeft className="size-3.5 shrink-0 text-ink-soft rtl:-scale-x-100" aria-hidden />}
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-line px-4 py-2 text-xs text-ink-soft">
              <span>{searching ? t.searching : " "}</span>
              <span className="flex items-center gap-1.5">
                <kbd className="rounded border border-line px-1.5">↵</kbd> {t.toSelect}
                <kbd className="ms-2 rounded border border-line px-1.5">Esc</kbd>
              </span>
            </div>
          </div>
        </div>
      , document.body)}
    </>
  );
}
