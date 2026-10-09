import {
  Suspense,
  lazy,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentType,
  type KeyboardEvent,
  type LazyExoticComponent,
} from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import type { ReportsCompare } from "@store-builder/api-client";
import { cn } from "@store-builder/ui";
import { StateMessage } from "@/components/DataState";
import { PageHeader } from "@/components/PageHeader";
import { Select } from "@/components/Select";
import { IconCalendar, IconLock } from "@/components/icons";
import { ReportTab, ReportTabState, type ReportTabProps } from "@/components/report";
import { useMediaQuery } from "@/components/report/useMediaQuery";
import { useWorkspace } from "@/context/WorkspaceContext";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { formatWindow } from "@/lib/analytics";
import { canViewAnalytics } from "@/lib/analyticsAccess";
import { countOf, pluralOf } from "@/lib/plural";
import { ReportCurrencySelect } from "@/lib/reportCurrency";
import { REPORT_COMPARES, REPORT_PRESETS, useReportRange, type ReportPreset, type ReportRange } from "@/lib/reportRange";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import {
  REPORT_TABS,
  REPORT_TAB_LABELS,
  REPORT_TAB_PATHS,
  REPORT_TAB_QUESTIONS,
  reportTabFromPath,
  type ReportTabKey,
} from "./reportTabs";

const STRINGS = {
  en: {
    title: "Reports",
    description: "Sales, orders, ads, products and customers — for {window}.",
    descriptionNow: "What is happening in your store right now. It updates by itself.",
    tabs: "Reports",
    live: "Live",
    liveNote: "These numbers update by themselves — the period doesn't apply here.",
    noAccessTitle: "This page isn't part of your role",
    noAccess: "Ask the store owner to give you access from Settings → Team.",
  },
  ar: {
    title: "التقارير",
    description: "المبيعات والأوردرات والإعلانات والمنتجات والعملاء — عن {window}.",
    descriptionNow: "اللي بيحصل في متجرك دلوقتي، وبيتحدّث لوحده.",
    tabs: "التقارير",
    live: "مباشر",
    liveNote: "الأرقام هنا بتتحدّث لوحدها — الفترة مش بتأثر عليها.",
    noAccessTitle: "الصفحة دي مش ضمن صلاحياتك",
    noAccess: "اطلب من صاحب المتجر يفتحهالك من الإعدادات ← الفريق.",
  },
} satisfies Messages;

const RANGE_STRINGS = {
  en: {
    label: "Period",
    today: "Today",
    yesterday: "Yesterday",
    last: "Last {span}",
    months_one: "1 month",
    months_other: "{n} months",
    month: "This month",
    lastMonth: "Last month",
    custom: "Pick the dates",
    from: "From day",
    to: "To day",
    compareLabel: "Compare with",
    previous: "Compare with the period before",
    year: "Compare with the same days last year",
    none: "No comparison",
  },
  ar: {
    label: "الفترة",
    today: "النهارده",
    yesterday: "إمبارح",
    last: "آخر {span}",
    months_one: "شهر واحد",
    months_two: "شهرين",
    months_few: "{n} شهور",
    months_other: "{n} شهر",
    month: "الشهر ده",
    lastMonth: "الشهر اللي فات",
    custom: "اختار التواريخ",
    from: "من يوم",
    to: "لحد يوم",
    compareLabel: "قارن بـ",
    previous: "قارن بالفترة اللي قبلها",
    year: "قارن بنفس الأيام السنة اللي فاتت",
    none: "من غير مقارنة",
  },
} satisfies Messages;

// ------------------------------------------------------------------ tabs --

type TabModule = { default: ComponentType<ReportTabProps> };

/** One chunk per tab, fetched when the tab is opened — or pointed at, so it is here by the time the tap lands. */
const TAB_LOADERS: Record<ReportTabKey, () => Promise<TabModule>> = {
  sales: () => import("./tabs/SalesTab"),
  journey: () => import("./tabs/JourneyTab"),
  ads: () => import("./tabs/AdsTab"),
  products: () => import("./tabs/ProductsTab"),
  customers: () => import("./tabs/CustomersTab"),
  store: () => import("./tabs/StoreTab"),
  now: () => import("./tabs/NowTab"),
};

const TAB_VIEWS: Record<ReportTabKey, LazyExoticComponent<ComponentType<ReportTabProps>>> = {
  sales: lazy(TAB_LOADERS.sales),
  journey: lazy(TAB_LOADERS.journey),
  ads: lazy(TAB_LOADERS.ads),
  products: lazy(TAB_LOADERS.products),
  customers: lazy(TAB_LOADERS.customers),
  store: lazy(TAB_LOADERS.store),
  now: lazy(TAB_LOADERS.now),
};

/** A failed warm-up is not an error: the tab's own lazy() asks again when it is opened. */
function warmTab(key: ReportTabKey) {
  void TAB_LOADERS[key]().catch(() => undefined);
}

/**
 * The old reports screen kept its section in `?tab=` on this same address. Those links (bookmarks,
 * pinned shortcuts) land on the tab that took the section over, with the rest of the query string.
 */
const LEGACY_TABS = new Map<string, ReportTabKey>([
  ["products", "products"],
  ["delivery", "journey"],
  ["customers", "customers"],
]);

const PANEL_ID = "report-tabpanel";
const tabId = (key: ReportTabKey) => `report-tab-${key}`;

// One tab: a full pill, 44px tall. On its own (glass off) the chosen one is the solid brand fill;
// glass/reports.css gives the track its pane and the chosen tab the shared selection fill.
const TAB =
  "inline-flex h-11 shrink-0 cursor-pointer items-center gap-2 rounded-full px-4 text-sm font-medium whitespace-nowrap select-none " +
  "transition-[scale,background-color,color] duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-reduce:transition-none " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.97] motion-reduce:active:scale-100";
const TAB_ON = "bg-primary font-semibold text-primary-foreground forced-colors:bg-[color:Highlight] forced-colors:text-[color:HighlightText]";
const TAB_OFF = "text-ink-soft hover:bg-paper-raised hover:text-ink";

/**
 * The hub's tab bar: one pill track. On a phone it is a single row that
 * scrolls sideways, the current tab brought to the middle; from md, where a
 * mouse cannot swipe a row, it wraps instead.
 *
 * Real tabs (`role="tablist"`): one stop for Tab, then ← → (following the
 * reading direction), Home and End move and open at once. Each tab is also a
 * real link — it can be opened in a new browser tab — and keeps the query
 * string, so the range picked in the header goes along to the next tab.
 *
 * Moving between tabs is a plain navigation, not a page-level view
 * transition: the title, the range and this bar stay still, and only the
 * tab's body settles in (the panel below).
 */
function ReportTabBar({ current, search, label }: { current: ReportTabKey; search: string; label: string }) {
  const labels = useT(REPORT_TAB_LABELS);
  const navigate = useNavigate();
  const listRef = useRef<HTMLDivElement>(null);
  const firstLook = useRef(true);

  // Keep the current tab in view in the scrolling row (a deep link lands on a later tab). The row
  // itself is moved, never the page; smoothly after the first look, unless less motion was asked for.
  useLayoutEffect(() => {
    const list = listRef.current;
    const tab = list?.querySelector<HTMLElement>('[aria-selected="true"]');
    const first = firstLook.current;
    firstLook.current = false;
    if (!list || !tab || list.scrollWidth <= list.clientWidth) return;
    const listBox = list.getBoundingClientRect();
    const tabBox = tab.getBoundingClientRect();
    const offset = tabBox.left + tabBox.width / 2 - (listBox.left + listBox.width / 2);
    const still = first || (typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    list.scrollBy({ left: offset, behavior: still ? "auto" : "smooth" });
  }, [current]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]'));
    const focused = tabs.findIndex((tab) => tab === document.activeElement);
    const index = focused >= 0 ? focused : REPORT_TABS.findIndex((tab) => tab.key === current);
    const last = REPORT_TABS.length - 1;
    // The direction of where the bar sits, not of the app.
    const rtl = window.getComputedStyle(event.currentTarget).direction === "rtl";
    let next: number;
    switch (event.key) {
      case "ArrowRight":
        next = index + (rtl ? -1 : 1);
        break;
      case "ArrowLeft":
        next = index + (rtl ? 1 : -1);
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = last;
        break;
      case " ":
        // A link opens on Enter by itself; a tab also answers to Space.
        if (focused >= 0) {
          event.preventDefault();
          tabs[focused]?.click();
        }
        return;
      default:
        return;
    }
    event.preventDefault();
    if (next < 0) next = last;
    else if (next > last) next = 0;
    const target = REPORT_TABS[next];
    if (!target) return;
    tabs[next]?.focus();
    if (target.key !== current) navigate({ pathname: target.path, search });
  }

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={label}
      aria-orientation="horizontal"
      onKeyDown={onKeyDown}
      className="zimos-report-tabs flex w-full gap-1 overflow-x-auto overscroll-x-contain rounded-full bg-paper-sunken p-1 ring-1 ring-line ring-inset [scrollbar-width:none] md:w-fit md:max-w-full md:flex-wrap md:overflow-x-visible md:rounded-[1.75rem] [&::-webkit-scrollbar]:hidden"
    >
      {REPORT_TABS.map((tab) => {
        const selected = tab.key === current;
        const TabIcon = tab.icon;
        const warm = () => warmTab(tab.key);
        return (
          <Link
            key={tab.key}
            id={tabId(tab.key)}
            role="tab"
            aria-selected={selected}
            aria-controls={PANEL_ID}
            // Roving focus: Tab lands on the current tab; the arrows reach the others.
            tabIndex={selected ? 0 : -1}
            to={{ pathname: tab.path, search }}
            onPointerEnter={warm}
            onTouchStart={warm}
            onFocus={warm}
            draggable={false}
            className={cn(TAB, selected ? TAB_ON : TAB_OFF)}
          >
            <TabIcon className="size-[18px] shrink-0" weight={selected ? "fill" : "regular"} aria-hidden />
            {labels[tab.key]}
          </Link>
        );
      })}
    </div>
  );
}

// ----------------------------------------------------------------- range --

const pad = (n: number) => String(n).padStart(2, "0");

/** Today as "YYYY-MM-DD" in the browser's own time zone — the same days `useReportRange` counts in. */
function todayString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

// `data-slot="input"` is the dashboard's hook for a field: the glass layer rounds it and lights it up in focus.
const DATE_INPUT =
  "h-11 min-w-0 flex-1 rounded-[var(--radius)] border border-line-strong bg-paper-raised px-3 text-sm text-ink tabular-nums focus-visible:outline-2 focus-visible:outline-primary sm:flex-none";

/**
 * The ONE range of the hub: the period, two dates when «اختار التواريخ» is
 * picked, and what to compare with — the controls of the old reports screen
 * (a select, native date fields), 44px tall. The choice lives in the address
 * (`useReportRange`), which the tab bar carries from tab to tab.
 */
function ReportRangeBar({
  range,
  onPreset,
  onDays,
  onCompare,
}: {
  range: ReportRange;
  onPreset: (preset: ReportPreset) => void;
  onDays: (fromDay: string, toDay: string) => void;
  onCompare: (compare: ReportsCompare) => void;
}) {
  const t = useT(RANGE_STRINGS);
  const today = todayString();

  function presetLabel(preset: ReportPreset): string {
    switch (preset) {
      case "7d":
        return fmt(t.last, { span: countOf("day", 7) });
      case "30d":
        return fmt(t.last, { span: countOf("day", 30) });
      case "90d":
        return fmt(t.last, { span: countOf("day", 90) });
      case "12m":
        return fmt(t.last, { span: pluralOf(t, "months", 12) });
      default:
        return t[preset];
    }
  }

  // A range that ends before it starts would be thrown away by the address parser and the
  // picker would jump back to the default period: the other end follows instead.
  function changeFrom(day: string) {
    if (day) onDays(day, day > range.toDay ? day : range.toDay);
  }
  function changeTo(day: string) {
    if (day) onDays(day < range.fromDay ? day : range.fromDay, day);
  }

  return (
    <div data-slot="report-range" className="flex min-h-11 flex-wrap items-start gap-2">
      <div className="relative min-w-0 flex-[1_1_9rem] sm:flex-none">
        <IconCalendar
          className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-soft"
          aria-hidden
        />
        <Select
          aria-label={t.label}
          value={range.preset}
          onChange={(event) => onPreset(event.target.value as ReportPreset)}
          className="h-11 ps-9 font-medium sm:w-auto"
        >
          {REPORT_PRESETS.map((preset) => (
            <option key={preset} value={preset}>
              {presetLabel(preset)}
            </option>
          ))}
        </Select>
      </div>

      {range.preset === "custom" && (
        // On a phone the two dates take a row of their own, under the two selects.
        <div className="order-last flex w-full min-w-0 items-center gap-2 sm:order-none sm:w-auto">
          <input
            type="date"
            data-slot="input"
            aria-label={t.from}
            value={range.fromDay}
            max={today}
            onChange={(event) => changeFrom(event.target.value)}
            className={DATE_INPUT}
          />
          <span className="text-sm text-ink-soft" aria-hidden>
            –
          </span>
          <input
            type="date"
            data-slot="input"
            aria-label={t.to}
            value={range.toDay}
            max={today}
            onChange={(event) => changeTo(event.target.value)}
            className={DATE_INPUT}
          />
        </div>
      )}

      <div className="min-w-0 flex-[1_1_9rem] sm:flex-none">
        <Select
          aria-label={t.compareLabel}
          value={range.compare}
          onChange={(event) => onCompare(event.target.value as ReportsCompare)}
          className="h-11 font-medium sm:w-auto"
        >
          {REPORT_COMPARES.map((compare) => (
            <option key={compare} value={compare}>
              {t[compare]}
            </option>
          ))}
        </Select>
      </div>

      {/* The amounts' currency: renders nothing for a store with no rates, and then the box is hidden. */}
      <div className="min-w-0 empty:hidden [&_select]:h-11">
        <ReportCurrencySelect />
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ page --

/**
 * «التقارير»: analytics as ONE page with seven tabs, each named after the
 * question it answers. The tab comes from the address (`/analytics`,
 * `/analytics/<tab>`), the range from its query string (`useReportRange`) —
 * one range for the whole hub, kept when moving between tabs; the "now" tab
 * shows what is happening this minute and a «مباشر» chip in place of the range.
 *
 * Each tab is its own chunk (pages/reports/tabs/<Key>Tab.tsx, a default export
 * taking `ReportTabProps`), shown behind a skeleton in the tab's shape.
 *
 * A system role without `analytics.view` gets the no-permission state; any
 * other role is let through and the server decides, tab by tab and section by
 * section (a 403 becomes `ReportTabState`'s no-permission state).
 */
export function ReportsHubPage() {
  const t = useT(STRINGS);
  const questions = useT(REPORT_TAB_QUESTIONS);
  const { currentWorkspace } = useWorkspace();
  const workspaceId = useWorkspaceId();
  const role = currentWorkspace?.role;
  const location = useLocation();
  const { range, setPreset, setDays, setCompare } = useReportRange();
  const wide = useMediaQuery("(min-width: 40rem)");
  const tabKey = reportTabFromPath(location.pathname);

  // The tab the page was opened on arrives with the page's own fade; only a tab switched to
  // afterwards settles in by itself.
  const [entryTab, setEntryTab] = useState<ReportTabKey | null>(tabKey);
  // Adjusted while rendering (no effect, no extra paint): once the tab has changed, every tab is a switch.
  if (entryTab !== null && entryTab !== tabKey) setEntryTab(null);
  const switched = entryTab !== tabKey;

  if (!canViewAnalytics(role)) {
    return (
      <div>
        <PageHeader title={t.title} />
        <StateMessage role="alert" icon={<IconLock aria-hidden />} title={t.noAccessTitle} description={t.noAccess} />
      </div>
    );
  }

  // A link to a section of the old reports screen (`/analytics?tab=delivery`) opens the tab that took it over.
  const legacyTab = tabKey === "sales" ? LEGACY_TABS.get(new URLSearchParams(location.search).get("tab") ?? "") : undefined;
  if (legacyTab) {
    const rest = new URLSearchParams(location.search);
    rest.delete("tab");
    const search = rest.toString();
    return <Navigate replace to={{ pathname: REPORT_TAB_PATHS[legacyTab], search: search ? `?${search}` : "" }} />;
  }

  const live = tabKey === "now";
  const TabView = TAB_VIEWS[tabKey];
  // No description on a phone: the title, the range and the tabs are already three rows before any number.
  const description = !wide ? undefined : live ? t.descriptionNow : fmt(t.description, { window: formatWindow(range.from, range.to) });

  return (
    <div data-report-hub="">
      <PageHeader title={t.title} description={description} />

      <div className="mb-3">
        {live ? (
          <div data-slot="report-range" className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1">
            <span
              data-slot="report-live"
              className="inline-flex h-8 shrink-0 items-center gap-2 rounded-full bg-success-soft px-3 text-[13px] font-semibold text-success ring-1 ring-success/20 ring-inset"
            >
              <span aria-hidden className="relative flex size-2">
                <span className="absolute inline-flex size-full rounded-full bg-success opacity-60 motion-safe:animate-ping" />
                <span className="relative inline-flex size-2 rounded-full bg-success" />
              </span>
              {t.live}
            </span>
            <p className="min-w-0 text-[13px] leading-5 text-ink-soft">{t.liveNote}</p>
          </div>
        ) : (
          <ReportRangeBar range={range} onPreset={setPreset} onDays={setDays} onCompare={setCompare} />
        )}
      </div>

      <div className="mb-5">
        <ReportTabBar current={tabKey} search={location.search} label={t.tabs} />
      </div>

      <div
        // A new panel per tab: the Suspense boundary inside is new too, so a tab whose code is still
        // on its way shows its skeleton at once instead of holding the press.
        key={tabKey}
        role="tabpanel"
        id={PANEL_ID}
        aria-labelledby={tabId(tabKey)}
        className={cn(
          "min-w-0",
          switched && "animate-[page-in_220ms_var(--ease-out)_backwards] motion-reduce:animate-none [html[data-vt]_&]:animate-none"
        )}
      >
        <Suspense
          fallback={
            <ReportTab question={questions[tabKey]}>
              <ReportTabState loading>{null}</ReportTabState>
            </ReportTab>
          }
        >
          <TabView workspaceId={workspaceId} range={range} role={role} />
        </Suspense>
      </div>
    </div>
  );
}
