import { useEffect, useId } from "react";
import { Button, Card, cn } from "@store-builder/ui";
import { homeGetOverview, type HomeOverview } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { isPermissionError } from "@/lib/errors";
import { useCachedAsync } from "@/lib/useCachedAsync";
import { useSessionBool } from "@/lib/useSessionState";
import { useRememberedChoice } from "@/lib/rememberedChoice";
import { canViewAnalytics } from "@/lib/analyticsAccess";
import { deltaBasisPoints, formatCount, rangeWindows } from "@/lib/analytics";
import { formatMinorMoney, formatPercentValue } from "@/lib/format";
import { countOf, pluralOf } from "@/lib/plural";
import { KpiCard } from "@/components/KpiCard";
import { Select } from "@/components/Select";
import { ViewLink } from "@/components/ViewLink";
import {
  IconCaretDown,
  IconCaretLeft,
  IconChart,
  IconChecklist,
  IconCourier,
  IconLostOrders,
  IconOrders,
  IconPlace,
  IconTrophy,
  IconWallet,
  type IconComponent,
} from "@/components/icons";
import { StoreOverview } from "@/pages/home/StoreOverview";
import { SiteAnalytics } from "@/pages/home/SiteAnalytics";
import { HomeSection, HomeSectionError } from "@/pages/home/today/HomeSection";
import type { HomeRange, HomeSectionProps } from "@/pages/home/today/homeTime";
import { fmt, useCommon, useT, type Messages } from "@/i18n/LocaleContext";

/*
 * Plural forms follow lib/plural.ts (`<key>_one/_two/_few/_other`). English
 * only ever picks `_one` and `_other`; the other two are there so both
 * languages carry the same keys.
 */
const STRINGS = {
  en: {
    title: "All the numbers in detail",
    hint: "Visits, the store funnel, offers, sources, governorates and devices — and the numbers of one product or one store.",
    show: "Show",
    hide: "Hide",

    product: "Product",
    store: "Store",
    allProducts: "All products",
    allStores: "All stores",
    clearFilters: "Clear filters",
    numbersPick: "One product or one store",
    numbersFor: "Numbers for {name}",
    pickHint: "Pick a product or a store to see its sales, orders, confirmation and delivery on their own.",
    filteredNote:
      "Only these numbers follow the filter. The rest of the page and the report below are for the whole store, and profit by product is on the profit report.",
    loadError: "We couldn't load these numbers.",

    when_today: "today",
    whenLast: "in the last {days}",

    sales: "Sales",
    orders: "Orders",
    confirmation: "Confirmation rate",
    delivery: "Delivery rate",
    confirmationHint: "Confirmed ÷ cash-on-delivery orders",
    deliveryHint: "Delivered ÷ handed to the courier",
    rateNone: "Shows up after the first orders.",

    lost_one: "1 customer started an order {when} and didn't finish it.",
    lost_two: "{n} customers started an order {when} and didn't finish it.",
    lost_few: "{n} customers started an order {when} and didn't finish it.",
    lost_other: "{n} customers started an order {when} and didn't finish it.",
    lostAction: "Bring them back",
    topSeller: "The best seller {when} is “{name}” ({units}).",
    topSellerAction: "See products",
    productNoName: "A deleted product",
    whereGov: "Most orders {when} come from {name} ({orders}).",
    whereSource: "The top traffic source is {name}.",
    storeWide: "visits are for the whole store",
    direct: "direct visits",
    whereAction: "See sales sources",

    wholeStore: "The whole store",
    fullReports: "Open the full reports",
  },
  ar: {
    title: "كل الأرقام بالتفصيل",
    hint: "الزيارات، مسار الشراء، العروض، المصادر، المحافظات والأجهزة — وأرقام منتج أو متجر لوحده.",
    show: "اعرض",
    hide: "اخفي",

    product: "المنتج",
    store: "المتجر",
    allProducts: "كل المنتجات",
    allStores: "كل المتاجر",
    clearFilters: "امسح الفلاتر",
    numbersPick: "أرقام منتج أو متجر واحد",
    numbersFor: "أرقام {name}",
    pickHint: "اختار منتج أو متجر وشوف مبيعاته وأوردراته ونسبة تأكيده وتسليمه لوحده.",
    filteredNote: "الأرقام دي بس اللي ماشية مع الفلتر. باقي الصفحة والتقرير اللي تحت للمتجر كله، وربح كل منتج في تقرير الأرباح.",
    loadError: "معرفناش نجيب الأرقام دي.",

    when_today: "النهارده",
    whenLast: "في آخر {days}",

    sales: "المبيعات",
    orders: "الأوردرات",
    confirmation: "نسبة التأكيد",
    delivery: "نسبة التسليم",
    confirmationHint: "اللي اتأكد ÷ أوردرات الدفع عند الاستلام",
    deliveryHint: "اللي اتسلّم ÷ اللي خرج مع المندوب",
    rateNone: "هتظهر بعد أول أوردرات.",

    lost_one: "عميل واحد بدأ يطلب {when} ومكمّلش.",
    lost_two: "عميلين بدأوا يطلبوا {when} ومكمّلوش.",
    lost_few: "{n} عملاء بدأوا يطلبوا {when} ومكمّلوش.",
    lost_other: "{n} عميل بدأوا يطلبوا {when} ومكمّلوش.",
    lostAction: "رجّعهم",
    topSeller: "أكتر منتج اتباع {when} هو «{name}» ({units}).",
    topSellerAction: "شوف المنتجات",
    productNoName: "منتج اتمسح",
    whereGov: "أغلب الأوردرات {when} من {name} ({orders}).",
    whereSource: "أكتر مصدر بيجيب زيارات: {name}.",
    storeWide: "الزيارات للمتجر كله",
    direct: "الزيارات المباشرة",
    whereAction: "شوف مصادر المبيعات",

    wholeStore: "المتجر كله",
    fullReports: "افتح التقارير الكاملة",
  },
} satisfies Messages;

interface Choice {
  id: string;
  name: string;
}

/** A name inside a sentence of the other script keeps its own direction (Unicode FSI…PDI). */
const isolate = (text: string) => `⁨${text}⁩`;

/** Figures round to the whole pound, as on the old home's tiles; exact amounts live on the reports. */
const money = (amount: number, currency: string) => formatMinorMoney(Math.round(amount / 100) * 100, currency);

/** Rates arrive as percentages (62.5); null when there is nothing to divide by. */
const rate = (percent: number | null) => (percent === null ? "—" : formatPercentValue(percent / 100, 0));

/** A 403 means this role can't see it (null, the block hides); anything else stays an error. */
function nullIfDenied(err: unknown): null {
  if (isPermissionError(err)) return null;
  throw err;
}

const KPI_GRID = "grid grid-cols-2 gap-[var(--bento-gap)] lg:grid-cols-4";

/**
 * «كل الأرقام بالتفصيل» — the drawer at the end of «اليوم». The page above
 * answers the five questions a merchant opens the dashboard with; everything
 * else the old home showed is kept here, one tap away and closed until asked
 * for: the numbers of one product or one store (the old product and store
 * filters), then the whole store's metric wall, its funnel, offers, sources,
 * governorates and devices (StoreOverview), the website's own traffic
 * (SiteAnalytics), and the way into the full reports.
 *
 * A real disclosure: the heading is a button with `aria-expanded`, and what
 * it opens is mounted — and asks the API — only while it is open. It stays
 * open for this browser tab once opened, so coming back from a report lands
 * where the merchant left off; a new tab starts closed again.
 */
export function HomeDetails({ workspaceId, range, role }: HomeSectionProps) {
  const t = useT(STRINGS);
  const [open, setOpen] = useSessionBool("zimos.home.details.open", false);
  const id = useId();
  if (!canViewAnalytics(role)) return null;
  const buttonId = `${id}toggle`;
  const panelId = `${id}panel`;

  return (
    <section data-slot="home-details" data-open={open ? "" : undefined} className="zimos-home-details min-w-0">
      <h2>
        <button
          type="button"
          id={buttonId}
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          onClick={() => setOpen((was) => !was)}
          className="zimos-home-details-toggle group flex min-h-16 w-full cursor-pointer items-center gap-3 rounded-[var(--radius-card)] bg-paper-raised px-4 py-3 text-start shadow-[var(--shadow-card)] ring-1 ring-line transition-[scale,background-color] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-paper-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.99] motion-reduce:transition-none motion-reduce:active:scale-100"
        >
          <span
            aria-hidden
            className="zimos-home-details-chip flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-dark"
          >
            <IconChart className="size-5" weight="duotone" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] leading-6 font-semibold text-ink">{t.title}</span>
            <span className="block truncate text-[13px] leading-5 font-normal text-ink-soft">{t.hint}</span>
          </span>
          <span aria-hidden className="hidden shrink-0 text-[13px] font-medium text-primary sm:inline">
            {open ? t.hide : t.show}
          </span>
          <IconCaretDown
            aria-hidden
            className={cn(
              "size-5 shrink-0 text-ink-soft transition-transform duration-[var(--dur-move)] ease-[var(--ease-spring)] motion-reduce:transition-none",
              open && "rotate-180"
            )}
          />
        </button>
      </h2>

      {open && (
        <div id={panelId} role="region" aria-labelledby={buttonId} className="zimos-home-details-panel mt-4 min-w-0 space-y-6">
          {/* Another store: its own remembered filters and its own lists, from scratch. */}
          <DetailsBody key={workspaceId} workspaceId={workspaceId} range={range} />
        </div>
      )}
    </section>
  );
}

/** What the drawer holds. Mounted only while it is open, so a closed drawer asks for nothing. */
function DetailsBody({ workspaceId, range }: { workspaceId: string; range: HomeRange }) {
  const t = useT(STRINGS);
  // Item 172: narrow the numbers to one product or one store (website). Same keys as the old home, so a
  // filter the merchant left on is still on.
  const [productId, setProductId] = useRememberedChoice<string>("home.answers.product", "");
  const [websiteId, setWebsiteId] = useRememberedChoice<string>("home.answers.website", "");
  const products = useCachedAsync<Choice[]>(
    `home:details:products:${workspaceId}`,
    () =>
      apiClient
        .listProducts(workspaceId, { limit: 100 })
        .then((r) => r.products.map((p) => ({ id: p.id, name: p.name })).sort((a, b) => a.name.localeCompare(b.name)))
        .catch((): Choice[] => []),
    [workspaceId]
  );
  const websites = useCachedAsync<Choice[]>(
    `home:details:websites:${workspaceId}`,
    () =>
      apiClient
        .listWebsites(workspaceId)
        .then((list) => list.map((w) => ({ id: w.id, name: w.name })))
        .catch((): Choice[] => []),
    [workspaceId]
  );

  // A remembered product or store that no longer exists falls back to all (the API would refuse it).
  useEffect(() => {
    if (productId && products.data && products.data.length > 0 && !products.data.some((p) => p.id === productId)) setProductId("");
  }, [productId, products.data, setProductId]);
  useEffect(() => {
    if (websiteId && websites.data && !websites.data.some((w) => w.id === websiteId)) setWebsiteId("");
  }, [websiteId, websites.data, setWebsiteId]);

  const productChoices = products.data ?? [];
  const websiteChoices = websites.data ?? [];
  // One website means one store: no point in choosing.
  const canFilter = productChoices.length > 0 || websiteChoices.length > 1;

  return (
    <>
      {canFilter && (
        <FilteredNumbers
          workspaceId={workspaceId}
          range={range}
          productId={productId}
          websiteId={websiteId}
          products={productChoices}
          websites={websiteChoices}
          onProduct={setProductId}
          onWebsite={setWebsiteId}
        />
      )}

      {/* The period, funnel and currency of this report are its own, as they always were. */}
      <HomeSection title={t.wholeStore}>
        <StoreOverview />
      </HomeSection>

      <SiteAnalytics />

      <div className="flex justify-center">
        <Button variant="outline" asChild className="h-11 px-5">
          <ViewLink to="/analytics">
            {t.fullReports}
            <IconCaretLeft className="ltr:rotate-180" weight="bold" aria-hidden />
          </ViewLink>
        </Button>
      </div>
    </>
  );
}

/**
 * The numbers of ONE product or ONE store for the page's period, against the
 * period before: the old home's product and store filters, with the same
 * request behind them (the overview endpoint with `productId` / `websiteId`).
 * With nothing chosen it asks for nothing — the whole store's numbers are the
 * page above and the report below.
 */
function FilteredNumbers({
  workspaceId,
  range,
  productId,
  websiteId,
  products,
  websites,
  onProduct,
  onWebsite,
}: {
  workspaceId: string;
  range: HomeRange;
  productId: string;
  websiteId: string;
  products: Choice[];
  websites: Choice[];
  onProduct: (id: string) => void;
  onWebsite: (id: string) => void;
}) {
  const t = useT(STRINGS);
  const common = useCommon();
  const headingId = useId();
  const filtered = Boolean(productId || websiteId);

  // null: nothing chosen, or this role can't read it; any other failure stays an error, never a zero.
  const overview = useCachedAsync<HomeOverview | null>(
    filtered ? `home:details:overview:${workspaceId}:${range}:${productId}:${websiteId}` : null,
    () =>
      filtered
        ? homeGetOverview(apiClient, workspaceId, {
            ...rangeWindows(range).current,
            compare: "previous",
            productId: productId || undefined,
            websiteId: websiteId || undefined,
          }).catch(nullIfDenied)
        : Promise.resolve(null),
    [workspaceId, range, productId, websiteId]
  );

  // The heading names what the numbers are narrowed to («أرقام Demo T-Shirt»).
  const filterName = [products.find((p) => p.id === productId)?.name, websites.find((w) => w.id === websiteId)?.name]
    .filter(Boolean)
    .join(" · ");
  const when = whenOf(t, range);

  return (
    <section aria-labelledby={headingId} className="min-w-0">
      <div className="mb-2.5 flex flex-wrap items-center gap-2 px-1">
        <div className="me-auto flex min-w-0 basis-full items-baseline gap-2 sm:basis-auto">
          <h3 id={headingId} className="min-w-0 truncate text-[13px] font-semibold text-ink-soft">
            {filtered && filterName ? fmt(t.numbersFor, { name: isolate(filterName) }) : t.numbersPick}
          </h3>
          {filtered && <span className="shrink-0 text-xs text-ink-soft">{when}</span>}
        </div>
        {products.length > 0 && (
          <Select
            aria-label={t.product}
            value={productId}
            onChange={(e) => onProduct(e.target.value)}
            className={cn("h-10 w-auto max-w-[14rem] min-w-0 flex-1 sm:flex-none pointer-coarse:h-11", productId && "border-primary text-primary-dark")}
          >
            <option value="">{t.allProducts}</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        )}
        {websites.length > 1 && (
          <Select
            aria-label={t.store}
            value={websiteId}
            onChange={(e) => onWebsite(e.target.value)}
            className={cn("h-10 w-auto max-w-[14rem] min-w-0 flex-1 sm:flex-none pointer-coarse:h-11", websiteId && "border-primary text-primary-dark")}
          >
            <option value="">{t.allStores}</option>
            {websites.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </Select>
        )}
        {filtered && (
          <Button
            variant="ghost"
            className="min-h-10 pointer-coarse:min-h-11"
            onClick={() => {
              onProduct("");
              onWebsite("");
            }}
          >
            {t.clearFilters}
          </Button>
        )}
      </div>

      {!filtered ? (
        <p className="px-1 text-sm leading-6 text-ink-soft">{t.pickHint}</p>
      ) : overview.loading ? (
        // The four cards in their own shape, so nothing below moves when the figures arrive.
        <div className={KPI_GRID}>
          <KpiCard label={t.sales} value={null} loading trend={[]} />
          <KpiCard label={t.orders} value={null} loading trend={[]} />
          <KpiCard label={t.confirmation} value={null} loading />
          <KpiCard label={t.delivery} value={null} loading />
        </div>
      ) : overview.error ? (
        <HomeSectionError message={t.loadError} retryLabel={common.retry} onRetry={() => void overview.refresh()} />
      ) : overview.data ? (
        <FilteredBody overview={overview.data} when={when} byProduct={Boolean(productId)} />
      ) : null}

      {filtered && <p className="mt-2.5 px-1 text-xs leading-5 text-ink-soft">{t.filteredNote}</p>}
    </section>
  );
}

type Strings = (typeof STRINGS)["en"];

/** The period inside a sentence: «النهارده», «في آخر ٧ أيام», «في آخر ٣٠ يوم». */
function whenOf(t: Strings, range: HomeRange): string {
  return range === "today" ? t.when_today : fmt(t.whenLast, { days: countOf("day", range === "7d" ? 7 : 30) });
}

interface Fact {
  key: string;
  icon: IconComponent;
  text: string;
  /** A quieter second sentence under the first. */
  more?: string;
  to: string;
  action: string;
}

function FilteredBody({ overview, when, byProduct }: { overview: HomeOverview; when: string; byProduct: boolean }) {
  const t = useT(STRINGS);
  const m = overview.metrics;

  const facts: Fact[] = [];
  const lost = m.lostOrders.value ?? 0;
  if (lost > 0) {
    facts.push({ key: "lost", icon: IconLostOrders, text: fmt(pluralOf(t, "lost", lost), { when }), to: "/abandoned-carts", action: t.lostAction });
  }
  // Narrowed to one product, "the best seller" could only be that product: said only for a store.
  const top = byProduct ? undefined : overview.topProducts.find((p) => p.quantity > 0);
  if (top) {
    facts.push({
      key: "top",
      icon: IconTrophy,
      text: fmt(t.topSeller, { name: isolate(top.name ?? t.productNoName), units: countOf("piece", top.quantity), when }),
      to: "/catalog",
      action: t.topSellerAction,
    });
  }
  const gov = overview.topGovernorates.find((g) => g.orders > 0);
  const source = overview.topSources.find((s) => s.visits > 0);
  if (gov || source) {
    // The API names visits with no referrer "direct".
    const sourceName = !source?.source || source.source === "direct" ? t.direct : source.source;
    // Narrowed by product, visits can't be split by product: the source is the whole store's, and says so.
    const sourceText = source
      ? fmt(t.whereSource, { name: isolate(sourceName) }) + (overview.eventScope === "store" ? ` (${t.storeWide})` : "")
      : undefined;
    facts.push({
      key: "where",
      icon: IconPlace,
      text: gov ? fmt(t.whereGov, { name: isolate(gov.name), orders: countOf("order", gov.orders), when }) : (sourceText ?? ""),
      more: gov ? sourceText : undefined,
      to: "/analytics/ads",
      action: t.whereAction,
    });
  }

  return (
    <div className="space-y-[var(--bento-gap)]">
      <div className={KPI_GRID}>
        <KpiCard
          label={t.sales}
          value={money(m.sales.value ?? 0, overview.currency)}
          deltaBasisPoints={deltaBasisPoints(m.sales.value, m.sales.previous)}
          trend={overview.series.map((d) => d.sales)}
          to="/analytics"
          icon={<IconWallet />}
        />
        <KpiCard
          label={t.orders}
          value={formatCount(m.orders.value ?? 0)}
          deltaBasisPoints={deltaBasisPoints(m.orders.value, m.orders.previous)}
          trend={overview.series.map((d) => d.orders)}
          to="/orders"
          icon={<IconOrders />}
        />
        <KpiCard
          label={t.confirmation}
          value={rate(m.confirmationRate.value)}
          deltaBasisPoints={deltaBasisPoints(m.confirmationRate.value, m.confirmationRate.previous)}
          hint={m.confirmationRate.value === null ? t.rateNone : t.confirmationHint}
          to="/confirmation-queue"
          icon={<IconChecklist />}
        />
        <KpiCard
          label={t.delivery}
          value={rate(m.deliveryRate.value)}
          deltaBasisPoints={deltaBasisPoints(m.deliveryRate.value, m.deliveryRate.previous)}
          hint={m.deliveryRate.value === null ? t.rateNone : t.deliveryHint}
          to="/orders?stage=shipped"
          icon={<IconCourier />}
        />
      </div>

      {facts.length > 0 && (
        <Card className="gap-0 p-0">
          <ul className="divide-y divide-line">
            {facts.map((fact) => (
              <li key={fact.key} className="flex min-h-16 flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
                <span
                  aria-hidden
                  className="zimos-home-details-chip flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-dark"
                >
                  <fact.icon className="size-[18px]" weight="duotone" />
                </span>
                <span className="min-w-0 flex-1 basis-48">
                  <span className="block text-sm leading-6 text-ink">{fact.text}</span>
                  {fact.more && <span className="block text-xs leading-5 text-ink-soft">{fact.more}</span>}
                </span>
                <ViewLink
                  to={fact.to}
                  className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-full px-2 text-[13px] font-medium text-primary focus-visible:outline-2 focus-visible:outline-primary pointer-coarse:min-h-11"
                >
                  {fact.action}
                  <IconCaretLeft className="size-3.5 ltr:rotate-180" weight="bold" aria-hidden />
                </ViewLink>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
