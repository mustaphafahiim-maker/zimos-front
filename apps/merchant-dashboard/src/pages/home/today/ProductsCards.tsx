import type { ReactNode } from "react";
import {
  profitGetPnl,
  reportsGetProducts,
  stockForecastGet,
  type ProfitPnl,
  type ReportsProducts,
  type StockForecast,
  type StockForecastVariant,
} from "@store-builder/api-client";
import { Card, cn } from "@store-builder/ui";
import {
  IconCaretLeft,
  IconInfo,
  IconProduct,
  IconReturns,
  IconStockLow,
  IconSuccess,
  IconTrophy,
  IconWarning,
  type Icon,
} from "@/components/icons";
import { StatusBadge } from "@/components/StatusBadge";
import { ViewLink } from "@/components/ViewLink";
import { fmt, useCommon, useT, type Messages } from "@/i18n/LocaleContext";
import { formatCount } from "@/lib/analytics";
import { canViewAnalytics } from "@/lib/analyticsAccess";
import { apiClient } from "@/lib/apiClient";
import { isPermissionError } from "@/lib/errors";
import { formatMinorMoney, formatPercentValue } from "@/lib/format";
import { NO_INVENTORY_ROLES } from "@/lib/inventoryAccess";
import { countOf, pluralOf } from "@/lib/plural";
import { canViewProducts } from "@/lib/productAccess";
import { useCachedAsync } from "@/lib/useCachedAsync";
import { HomeSection, HomeSectionError, HomeSkeleton } from "./HomeSection";
import { homeWindow, outOfTen, type HomeRange, type HomeSectionProps } from "./homeTime";

/*
 * Egyptian Arabic, second person, short. Plural forms follow lib/plural.ts:
 * `<key>_one/_two/_few/_other` (English only needs _one/_other).
 */
const STRINGS = {
  en: {
    title: "Products",
    rowLabel: "Product lists",
    allProducts: "All products",
    loadError: "We couldn't load your products' numbers.",
    partError: "We couldn't load this right now.",
    deletedProduct: "A deleted product",
    when_today: "today",
    when_7d: "in the last 7 days",
    when_30d: "in the last 30 days",

    earnersTitle: "Top earners",
    earnersCaption: "Profit from what was delivered · {range}",
    earnersOpen: "Open the profit report",
    earnersEmpty: "Your {n} best earners show up here once their orders are delivered.",
    earnersNoProfit: "No product has turned a profit {when} yet.",
    earnersCosts: "Only {pct} of the delivered items have a cost, so we can't tell you which product earns the most.",
    earnersCostsAction: "Complete the costs",
    rank: "Number {n}",
    delivered_one: "1 order delivered",
    delivered_other: "{n} orders delivered",
    deliveredAbout: "About {orders}",

    stockTitle: "Running out soon",
    stockCaption: "At the pace of the last {days}",
    stockCaptionPlain: "At the pace it sells now",
    stockOpen: "Open the stock forecast",
    stockOut: "Sold out",
    stockLeft: "{days} left",
    stockLastDay: "Less than a day left",
    stockLow: "Running low",
    stockPieces: "{pieces} left",
    stockEmpty: "Stock looks fine — nothing is about to run out.",
    moreVariants_one: "and 1 more option",
    moreVariants_other: "and {n} more options",
    stockMore_one: "1 more is out or running low",
    stockMore_other: "{n} more are out or running low",

    returnsTitle: "Coming back a lot",
    returnsCaption: "What came back of what shipped · {range}",
    returnsOpen: "Open the products report",
    returnsRate: "{k} of every 10 come back",
    returnsCalm: "No product comes back a lot — none is above {k} of every 10.",
    returnsTooFew: "Shows up here once a product has sold {pieces}.",
  },
  ar: {
    title: "المنتجات",
    rowLabel: "قوايم المنتجات",
    allProducts: "كل المنتجات",
    loadError: "معرفناش نجيب أرقام المنتجات.",
    partError: "معرفناش نجيب ده دلوقتي.",
    deletedProduct: "منتج اتمسح",
    when_today: "النهارده",
    when_7d: "في آخر ٧ أيام",
    when_30d: "في آخر ٣٠ يوم",

    earnersTitle: "الأكسب",
    earnersCaption: "ربح اللي اتسلّم · {range}",
    earnersOpen: "افتح تقرير الربح",
    earnersEmpty: "أكتر {n} منتجات كسّبوك هيظهروا هنا أول ما أوردراتهم تتسلّم.",
    earnersNoProfit: "مفيش منتج طلّع ربح {when} لسه.",
    earnersCosts: "{pct} بس من القطع اللي اتسلّمت ليها تكلفة، فمش هنقدر نقولك مين الأكسب.",
    earnersCostsAction: "كمّل التكاليف",
    rank: "رقم {n}",
    delivered_one: "أوردر واحد اتسلّم",
    delivered_two: "أوردرين اتسلّموا",
    delivered_few: "{n} أوردرات اتسلّمت",
    delivered_other: "{n} أوردر اتسلّم",
    deliveredAbout: "حوالي {orders}",

    stockTitle: "هيخلص قريب",
    stockCaption: "على سرعة بيع آخر {days}",
    stockCaptionPlain: "على سرعة بيعه دلوقتي",
    stockOpen: "افتح توقّع المخزون",
    stockOut: "خلص",
    stockLeft: "باقي {days}",
    stockLastDay: "باقي أقل من يوم",
    stockLow: "قرّب يخلص",
    stockPieces: "فاضل {pieces}",
    stockEmpty: "المخزون مطمّن — مفيش منتج هيخلص قريب.",
    moreVariants_one: "ونوع تاني",
    moreVariants_two: "ونوعين تانيين",
    moreVariants_few: "و{n} أنواع تانية",
    moreVariants_other: "و{n} نوع تاني",
    stockMore_one: "وفيه نوع واحد تاني خلص أو هيخلص قريب",
    stockMore_two: "وفيه نوعين تانيين خلصوا أو هيخلصوا قريب",
    stockMore_few: "وفيه {n} أنواع تانية خلصت أو هتخلص قريب",
    stockMore_other: "وفيه {n} نوع تاني خلص أو هيخلص قريب",

    returnsTitle: "بيرجع كتير",
    returnsCaption: "اللي رجع من اللي اتشحن · {range}",
    returnsOpen: "افتح تقرير المنتجات",
    returnsRate: "{k} من كل ١٠ بيرجعوا",
    returnsCalm: "مفيش منتج بيرجع كتير — ولا واحد عدّى {k} من كل ١٠.",
    returnsTooFew: "هيظهر هنا أول ما منتج يتباع منه {pieces}.",
  },
} satisfies Messages;

/** Rows per card. */
const TOP = 3;
/** Below this share of delivered items with a known cost, naming the "top earner" would mislead (the old home's rule). */
const MIN_COST_COVERAGE = 80;
/** A return rate is only read from a product with at least this many units (the report gives units sold, not units shipped). */
const MIN_UNITS = 5;
/** "Comes back a lot" starts above this return rate, in percent: 2 of every 10. */
const HIGH_RETURN_RATE = 20;
/** A P&L row's key is the product's id — or its name, when the product was deleted. Only an id is linked. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** One of the three reads: there, not for this role (403, or a role known not to hold the permission), or failed. */
type Part<T> = { state: "ok"; data: T } | { state: "denied" } | { state: "failed" };

interface Loaded {
  pnl: Part<ProfitPnl>;
  forecast: Part<StockForecast>;
  products: Part<ReportsProducts>;
}

/** A call that was not made (null) and a 403 both mean "this role does not see it". */
function partOf<T>(result: PromiseSettledResult<T | null>): Part<T> {
  if (result.status === "fulfilled") return result.value === null ? { state: "denied" } : { state: "ok", data: result.value };
  return isPermissionError(result.reason) ? { state: "denied" } : { state: "failed" };
}

async function loadProducts(workspaceId: string, range: HomeRange, allow: { money: boolean; stock: boolean }): Promise<Loaded> {
  const span = homeWindow(range);
  // Each read stands alone: one that fails or is refused takes only its own card with it.
  const [pnl, forecast, products] = await Promise.allSettled([
    allow.money ? profitGetPnl(apiClient, workspaceId, { ...span, groupBy: "product" }) : null,
    allow.stock ? stockForecastGet(apiClient, workspaceId, { limit: 6 }) : null,
    allow.money ? reportsGetProducts(apiClient, workspaceId, { ...span, limit: 50 }) : null,
  ]);
  return { pnl: partOf(pnl), forecast: partOf(forecast), products: partOf(products) };
}

/**
 * Side by side once the section itself is wide enough for a row to keep its name (three cards from 56rem, two
 * from 42rem); below that — a tablet beside the side menu — the cards stack. Measured on the section, not
 * the screen: the side menu takes 16rem of a 48rem tablet, where three columns would be 9rem each.
 */
const COLUMNS: Record<number, string> = { 1: "", 2: "@2xl:grid-cols-2", 3: "@4xl:grid-cols-3" };

/**
 * A phone (below md): two or three cards are ONE row that scrolls sideways and snaps, instead of a stack.
 * Each card is 82% of the row, so the next one shows its edge and says there is more. The row takes back
 * the page's 1rem gutter on both sides and gives it back as its own padding, so the cards run to the edge
 * of the screen while the first still lines up with the section's title — and that padding is where a
 * snapped card stops (scroll-px). The row itself is the scroller: the page never moves sideways, and a
 * sideways swipe ends at the row (overscroll-x-contain). Its box reaches a little above and below the
 * cards, because a scroller clips: that room is for their shadows. No scrollbar is drawn; a finger moves
 * it, and so does the keyboard, since Tab to a link in the next card brings that card in. It is `relative`
 * so the visually hidden labels inside the cards (they are absolutely placed) are positioned against the
 * row and clipped with it: left against the page, the ones in a card that is off screen would widen it.
 */
const PHONE_ROW =
  "max-md:relative max-md:-mx-4 max-md:-mt-2 max-md:-mb-5 max-md:flex max-md:snap-x max-md:snap-mandatory max-md:scroll-px-4 max-md:gap-3 max-md:overflow-x-auto max-md:overflow-y-hidden max-md:overscroll-x-contain max-md:px-4 max-md:pt-2 max-md:pb-5 max-md:[scrollbar-width:none] max-md:*:w-[82%] max-md:*:min-w-[82%] max-md:*:shrink-0 max-md:*:snap-start max-md:[&::-webkit-scrollbar]:hidden";
/** In that row every card is as tall as the tallest: the row stretches them, so their own `h-full` steps aside. */
const PHONE_ROW_CARDS = "max-md:*:h-auto";

/**
 * «المنتجات»: which products earn, which are about to run out, and which come
 * back — three short lists, each row one tap from the product. Profit and the
 * return rates follow the range of the home; the stock forecast is always now.
 * A card whose read is refused (403) is simply not there; with none left the
 * section is not drawn.
 */
export function ProductsCards(props: HomeSectionProps) {
  // One instance per store and range: a range seen before shows at once from the cache, a new one holds the
  // space. The figures of the last range are never on screen under the name of this one, not even for a frame.
  return <ProductsCardsFor key={`${props.workspaceId}:${props.range}`} {...props} />;
}

function ProductsCardsFor({ workspaceId, range, role }: HomeSectionProps) {
  const t = useT(STRINGS);
  const common = useCommon();
  // financial_reports.view and analytics.view are held by the same system roles; a custom role is asked and may get a 403.
  const money = canViewAnalytics(role);
  const stock = !NO_INVENTORY_ROLES.has(role ?? "");
  const cached = useCachedAsync<Loaded>(
    `home:products:${workspaceId}:${range}`,
    () => loadProducts(workspaceId, range, { money, stock }),
    [workspaceId, range, money, stock]
  );
  const { error, refresh } = cached;
  // Nothing to show while the first answer (or a retry after a failure) is on its way: hold the space.
  const data = cached.loading ? null : cached.data;

  if (!money && !stock) return null;

  const openProducts = canViewProducts(role);
  const link = openProducts ? { to: "/catalog", label: t.allProducts } : undefined;
  const retry = () => void refresh();

  if (!data) {
    const expected = (money ? 2 : 0) + (stock ? 1 : 0);
    return (
      <HomeSection title={t.title} link={link}>
        {error ? (
          <HomeSectionError message={t.loadError} retryLabel={common.retry} onRetry={retry} />
        ) : (
          <div className="@container">
            {/* The room of what is coming: one row on a phone when there will be more than one card, the grid from md. */}
            <HomeSkeleton
              count={expected}
              className={cn("h-60", expected > 1 && "max-md:h-[14.5rem]")}
              gridClassName={cn(COLUMNS[expected], expected > 1 && PHONE_ROW)}
            />
          </div>
        )}
      </HomeSection>
    );
  }

  const shown = [data.pnl, data.forecast, data.products].filter((part) => part.state !== "denied");
  if (shown.length === 0) return null;

  if (shown.every((part) => part.state === "failed")) {
    return (
      <HomeSection title={t.title} link={link}>
        <HomeSectionError message={t.loadError} retryLabel={common.retry} onRetry={retry} />
      </HomeSection>
    );
  }

  return (
    <HomeSection title={t.title} link={link}>
      <div className="@container">
        <div
          role="group"
          aria-label={t.rowLabel}
          className={cn(
            "grid grid-cols-1 gap-[var(--bento-gap)]",
            COLUMNS[shown.length],
            // A single card is not a row: it keeps the section's whole width on a phone too.
            shown.length > 1 && PHONE_ROW,
            shown.length > 1 && PHONE_ROW_CARDS
          )}
        >
          {data.pnl.state !== "denied" && <EarnersCard part={data.pnl} range={range} openProducts={openProducts} onRetry={retry} />}
          {data.forecast.state !== "denied" && <StockCard part={data.forecast} openProducts={openProducts} onRetry={retry} />}
          {data.products.state !== "denied" && (
            <ReturnsCard part={data.products} range={range} openProducts={openProducts} onRetry={retry} />
          )}
        </div>
      </div>
    </HomeSection>
  );
}

/* ------------------------------------------------------------------ */

type Tone = "primary" | "success" | "warning" | "danger" | "neutral";

/** The chip on a solid card. On glass, glass/home-orders.css re-tints it through data-tone. */
const CHIP: Record<Tone, string> = {
  primary: "bg-primary-soft text-primary-dark",
  success: "bg-success-soft text-success",
  warning: "bg-accent-soft text-accent-dark",
  danger: "bg-danger-soft text-danger",
  neutral: "bg-paper-sunken text-ink-soft",
};

/** The 36px mark a row or a card title starts with. Decorative: the words beside it say what it is. */
function Chip({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span
      aria-hidden
      data-slot="home-chip"
      data-tone={tone}
      className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", CHIP[tone])}
    >
      {children}
    </span>
  );
}

/** 52px tall; 48px on a phone, where it is still a full thumb target and the three cards share one short row. */
const ROW = "flex min-h-13 items-center gap-3 rounded-2xl px-2 py-1.5 max-md:min-h-12";
const ROW_LINK =
  "transition-colors duration-(--dur-fade) ease-(--ease-out) hover:bg-paper-sunken focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none";

/** A card of the section: its title line (the way into the full report), then its rows or its one calm line. */
function ListCard({
  icon: HeadIcon,
  tone,
  title,
  caption,
  to,
  openLabel,
  children,
}: {
  icon: Icon;
  tone: Tone;
  title: string;
  caption: string;
  to: string;
  openLabel: string;
  children: ReactNode;
}) {
  return (
    <Card data-slot="home-list-card" className="h-full gap-0 p-2">
      <ViewLink to={to} data-slot="home-row" className={cn(ROW, ROW_LINK)}>
        <Chip tone={tone}>
          <HeadIcon className="size-5" weight="duotone" />
        </Chip>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[15px] leading-5 font-semibold text-ink">{title}</h3>
          <p className="truncate text-xs leading-4 text-ink-soft">{caption}</p>
        </div>
        <IconCaretLeft className="size-4 shrink-0 text-ink-soft ltr:rotate-180" weight="bold" aria-hidden />
        <span className="sr-only">{openLabel}</span>
      </ViewLink>
      {children}
    </Card>
  );
}

/** A product: its mark, its name over one quiet line, and the one figure at the end. A link when the product can be opened. */
function Row({ to, lead, name, sub, end }: { to: string | null; lead: ReactNode; name: string; sub?: string; end: ReactNode }) {
  const body = (
    <>
      {lead}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm leading-5 font-medium text-ink">
          <bdi>{name}</bdi>
        </span>
        {sub ? <span className="block truncate text-xs leading-4 text-ink-soft">{sub}</span> : null}
      </span>
      <span className="flex shrink-0 items-center">{end}</span>
    </>
  );
  return (
    <li>
      {to ? (
        <ViewLink to={to} data-slot="home-row" className={cn(ROW, ROW_LINK)}>
          {body}
        </ViewLink>
      ) : (
        <div className={ROW}>{body}</div>
      )}
    </li>
  );
}

/** The one sentence a card says when it has no rows: what will show here, or that all is well. */
function Calm({ tone, children, action }: { tone: "success" | "warning" | "neutral"; children: ReactNode; action?: ReactNode }) {
  const CalmIcon = tone === "success" ? IconSuccess : tone === "warning" ? IconWarning : IconInfo;
  return (
    <div className="px-2 pt-1.5 pb-2">
      <p className="flex items-start gap-2 text-[13px] leading-5 text-ink-soft">
        <CalmIcon
          aria-hidden
          weight="fill"
          className={cn(
            "mt-0.5 size-4 shrink-0",
            tone === "success" ? "text-success" : tone === "warning" ? "text-accent-dark" : "text-ink-soft"
          )}
        />
        <span className="min-w-0">{children}</span>
      </p>
      {action ? <div className="mt-2 ps-6">{action}</div> : null}
    </div>
  );
}

/** A card whose own read failed: said plainly, with a way to try again — never passed off as "nothing here". */
function PartError({ onRetry }: { onRetry: () => void }) {
  const t = useT(STRINGS);
  const common = useCommon();
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-2 pt-1.5 pb-1">
      <p className="flex min-w-0 items-start gap-2 text-[13px] leading-5 text-ink-soft">
        <IconWarning aria-hidden weight="fill" className="mt-0.5 size-4 shrink-0 text-accent-dark" />
        <span className="min-w-0">{t.partError}</span>
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="min-h-11 shrink-0 cursor-pointer rounded-full px-3 text-[13px] font-semibold text-primary transition-colors hover:bg-paper-sunken focus-visible:outline-2 focus-visible:outline-primary motion-reduce:transition-none"
      >
        {common.retry}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */

/** Tiles round to the whole pound, as the old home did for the same figure; exact amounts live on the profit report. */
function wholeMoney(amount: number, currency: string): string {
  return formatMinorMoney(Math.round(amount / 100) * 100, currency);
}

/** «الأكسب»: the three products that earned the most from delivered orders in the range. */
function EarnersCard({
  part,
  range,
  openProducts,
  onRetry,
}: {
  part: Part<ProfitPnl>;
  range: HomeRange;
  openProducts: boolean;
  onRetry: () => void;
}) {
  const t = useT(STRINGS);
  const common = useCommon();
  const rangeLabel = range === "today" ? common.today : range === "7d" ? common.last7 : common.last30;
  const head = {
    icon: IconTrophy,
    tone: "success" as const,
    title: t.earnersTitle,
    caption: fmt(t.earnersCaption, { range: rangeLabel }),
    to: "/profit",
    openLabel: t.earnersOpen,
  };
  if (part.state !== "ok") {
    return (
      <ListCard {...head}>
        <PartError onRetry={onRetry} />
      </ListCard>
    );
  }

  const pnl = part.data;
  const coverage = pnl.costCoverage;

  // Nothing delivered in the range yet (coverage is null then): no earner to name.
  if (coverage === null || pnl.totals.orders.delivered <= 0) {
    return (
      <ListCard {...head}>
        <Calm tone="neutral">{fmt(t.earnersEmpty, { n: TOP })}</Calm>
      </ListCard>
    );
  }

  // Too many items without a cost: a ranking by profit would rank the unknown. Say so, and send to the costs.
  if (coverage < MIN_COST_COVERAGE) {
    return (
      <ListCard {...head}>
        <Calm
          tone="warning"
          action={
            <ViewLink
              to="/profit/costs"
              className="inline-flex min-h-11 items-center rounded-full px-4 text-[13px] font-semibold text-primary ring-1 ring-line-strong transition-colors ring-inset hover:bg-paper-sunken focus-visible:outline-2 focus-visible:outline-primary motion-reduce:transition-none"
            >
              {t.earnersCostsAction}
            </ViewLink>
          }
        >
          {fmt(t.earnersCosts, { pct: formatPercentValue(coverage / 100, 0) })}
        </Calm>
      </ListCard>
    );
  }

  const winners = pnl.rows
    .filter((row) => row.actual.netProfit > 0)
    .sort((a, b) => b.actual.netProfit - a.actual.netProfit)
    .slice(0, TOP);

  if (winners.length === 0) {
    const when = range === "today" ? t.when_today : range === "7d" ? t.when_7d : t.when_30d;
    return (
      <ListCard {...head}>
        <Calm tone="neutral">{fmt(t.earnersNoProfit, { when })}</Calm>
      </ListCard>
    );
  }

  return (
    <ListCard {...head}>
      <ol className="mt-0.5 space-y-0.5">
        {winners.map((row, index) => {
          const rank = index + 1;
          // An order is split across its lines, so a product's share of the delivered orders can be a
          // fraction: a whole number is said as it is, a fraction is rounded and said to be "about".
          const delivered = Math.round(row.orders.delivered);
          const deliveredText = delivered >= 1 ? pluralOf(t, "delivered", delivered) : undefined;
          const whole = Math.abs(row.orders.delivered - delivered) < 0.05;
          return (
            <Row
              key={row.key}
              to={openProducts && UUID.test(row.key) ? `/catalog/${row.key}` : null}
              name={row.label ?? t.deletedProduct}
              sub={deliveredText && !whole ? fmt(t.deliveredAbout, { orders: deliveredText }) : deliveredText}
              lead={
                <span
                  data-slot="home-rank"
                  data-rank={rank}
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-full text-sm leading-none font-semibold tabular-nums",
                    rank === 1 ? "bg-primary text-primary-foreground" : "bg-primary-soft text-primary-dark"
                  )}
                >
                  <span aria-hidden>{formatCount(rank)}</span>
                  <span className="sr-only">{fmt(t.rank, { n: rank })}</span>
                </span>
              }
              end={
                <span className="text-sm leading-5 font-semibold whitespace-nowrap text-ink tabular-nums">
                  <bdi>{wholeMoney(row.actual.netProfit, pnl.currency)}</bdi>
                </span>
              }
            />
          );
        })}
      </ol>
    </ListCard>
  );
}

/* ------------------------------------------------------------------ */

interface StockGroup {
  /** The product's most urgent variant: the forecast lists the most urgent first. */
  worst: StockForecastVariant;
  /** How many of its variants are among the urgent ones that were read. */
  variants: number;
}

/** The urgent variants as one line per product, most urgent first. "ok" and "no sales" are not running out. */
function stockGroups(forecast: StockForecast): StockGroup[] {
  const groups = new Map<string, StockGroup>();
  for (const variant of forecast.variants) {
    if (variant.status !== "out" && variant.status !== "reorder_now" && variant.status !== "soon") continue;
    const group = groups.get(variant.productId);
    if (group) group.variants += 1;
    else groups.set(variant.productId, { worst: variant, variants: 1 });
  }
  return Array.from(groups.values()).slice(0, TOP);
}

/** «هيخلص قريب»: what is out or will not last, from the stock forecast as it stands now. */
function StockCard({ part, openProducts, onRetry }: { part: Part<StockForecast>; openProducts: boolean; onRetry: () => void }) {
  const t = useT(STRINGS);
  const head = {
    icon: IconStockLow,
    tone: "warning" as const,
    title: t.stockTitle,
    caption:
      part.state === "ok" ? fmt(t.stockCaption, { days: countOf("day", part.data.settings.windowDays) }) : t.stockCaptionPlain,
    to: "/inventory/forecast",
    openLabel: t.stockOpen,
  };
  if (part.state !== "ok") {
    return (
      <ListCard {...head}>
        <PartError onRetry={onRetry} />
      </ListCard>
    );
  }

  const forecast = part.data;
  const groups = stockGroups(forecast);
  if (groups.length === 0) {
    return (
      <ListCard {...head}>
        <Calm tone="success">{t.stockEmpty}</Calm>
      </ListCard>
    );
  }

  // The store's urgent variants beyond the ones these rows stand for.
  const urgent = (forecast.counts.out ?? 0) + (forecast.counts.reorder_now ?? 0) + (forecast.counts.soon ?? 0);
  const more = Math.max(0, urgent - groups.reduce((sum, group) => sum + group.variants, 0));

  return (
    <ListCard {...head}>
      <ul className="mt-0.5 space-y-0.5">
        {groups.map(({ worst, variants }) => {
          const options = worst.optionValues ? Object.values(worst.optionValues).filter(Boolean).join(" · ") : "";
          const sub = [
            options,
            worst.available > 0 ? fmt(t.stockPieces, { pieces: countOf("piece", worst.available) }) : "",
            variants > 1 ? pluralOf(t, "moreVariants", variants - 1) : "",
          ]
            .filter(Boolean)
            .join(" · ");
          const text =
            worst.status === "out"
              ? t.stockOut
              : worst.daysLeft === null
                ? t.stockLow
                : worst.daysLeft < 1
                  ? t.stockLastDay
                  : fmt(t.stockLeft, { days: countOf("day", worst.daysLeft) });
          return (
            <Row
              key={worst.productId}
              to={openProducts ? `/catalog/${worst.productId}` : null}
              name={worst.productName}
              sub={sub || undefined}
              lead={
                <Chip tone="neutral">
                  <IconProduct className="size-[18px]" />
                </Chip>
              }
              end={
                // Out is danger; "will not outlast the supplier's lead time" is amber; "soon" stays quiet.
                <StatusBadge
                  value={worst.status}
                  tone={worst.status === "out" ? "danger" : worst.status === "reorder_now" ? "warning" : "neutral"}
                  text={text}
                />
              }
            />
          );
        })}
      </ul>
      {more > 0 && <p className="px-2 pt-1 pb-1.5 text-xs leading-5 text-ink-soft">{pluralOf(t, "stockMore", more)}</p>}
    </ListCard>
  );
}

/* ------------------------------------------------------------------ */

/** Ten dots, `k` of them lit: "k of every 10" at a glance. Decorative — the sentence beside it carries the number. */
function TenDots({ k }: { k: number }) {
  const danger = k >= 4;
  return (
    <span aria-hidden data-slot="home-dots" data-tone={danger ? "danger" : "warning"} className="grid grid-cols-5 gap-[3px]">
      {Array.from({ length: 10 }, (_, i) => (
        <i
          key={i}
          data-on={i < k ? "" : undefined}
          className={cn("block size-1.5 rounded-full", i < k ? (danger ? "bg-danger" : "bg-accent") : "bg-line-strong/60")}
        />
      ))}
    </span>
  );
}

/** «بيرجع كتير»: the products whose parcels come back most (refused at the door, failed deliveries), in the range. */
function ReturnsCard({
  part,
  range,
  openProducts,
  onRetry,
}: {
  part: Part<ReportsProducts>;
  range: HomeRange;
  openProducts: boolean;
  onRetry: () => void;
}) {
  const t = useT(STRINGS);
  const common = useCommon();
  const rangeLabel = range === "today" ? common.today : range === "7d" ? common.last7 : common.last30;
  const head = {
    icon: IconReturns,
    tone: "danger" as const,
    title: t.returnsTitle,
    caption: fmt(t.returnsCaption, { range: rangeLabel }),
    to: "/analytics",
    openLabel: t.returnsOpen,
  };
  if (part.state !== "ok") {
    return (
      <ListCard {...head}>
        <PartError onRetry={onRetry} />
      </ListCard>
    );
  }

  // A rate from two or three units says nothing: only products with enough behind them are judged.
  const judged = part.data.products.flatMap((product) =>
    product.units >= MIN_UNITS && product.returnRate !== null ? [{ product, rate: product.returnRate }] : []
  );
  if (judged.length === 0) {
    return (
      <ListCard {...head}>
        <Calm tone="neutral">{fmt(t.returnsTooFew, { pieces: countOf("piece", MIN_UNITS) })}</Calm>
      </ListCard>
    );
  }

  const high = judged
    .filter((entry) => entry.rate > HIGH_RETURN_RATE)
    .sort((a, b) => b.rate - a.rate)
    .slice(0, TOP);
  if (high.length === 0) {
    return (
      <ListCard {...head}>
        <Calm tone="success">{fmt(t.returnsCalm, { k: outOfTen(HIGH_RETURN_RATE) })}</Calm>
      </ListCard>
    );
  }

  return (
    <ListCard {...head}>
      <ul className="mt-0.5 space-y-0.5">
        {high.map(({ product, rate }) => {
          const k = outOfTen(rate);
          return (
            <Row
              key={product.productId}
              to={openProducts && UUID.test(product.productId) ? `/catalog/${product.productId}` : null}
              name={product.name || t.deletedProduct}
              sub={fmt(t.returnsRate, { k })}
              lead={
                <Chip tone="neutral">
                  <IconProduct className="size-[18px]" />
                </Chip>
              }
              end={<TenDots k={k} />}
            />
          );
        })}
      </ul>
    </ListCard>
  );
}
