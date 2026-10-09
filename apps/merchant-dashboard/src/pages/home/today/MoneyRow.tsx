import { useEffect, useRef, type ReactNode } from "react";
import { Card, cn } from "@store-builder/ui";
import {
  profitGetEconomics,
  profitGetPnl,
  statementGetHeld,
  type ProfitEconomicsProduct,
  type ProfitPnl,
  type ProfitStatement,
  type SettlementListItem,
  type SettlementListResponse,
  type StatementHeld,
  type StatementHeldCarrier,
} from "@store-builder/api-client";
import { IconBank, IconCaretLeft, IconCash, IconClock, IconProfit, IconWarning, type IconComponent } from "@/components/icons";
import { ViewLink } from "@/components/ViewLink";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { canViewAnalytics } from "@/lib/analyticsAccess";
import { apiClient } from "@/lib/apiClient";
import { isPermissionError } from "@/lib/errors";
import { formatMinorMoney, formatPercentValue } from "@/lib/format";
import { countOf, pluralOf } from "@/lib/plural";
import { providerName } from "@/lib/providers";
import { invalidateCached, useCachedAsync } from "@/lib/useCachedAsync";
import { HomeSection, HomeSectionError, HomeSkeleton } from "@/pages/home/today/HomeSection";
import { homeWindow, hoursSince, startOfWeek, useNow, waitedFor, type HomeRange, type HomeSectionProps } from "@/pages/home/today/homeTime";

/*
 * Egyptian Arabic, second person, short. Counts come from lib/plural.ts:
 * `<key>_one/_two/_few/_other` through `pluralOf`, and the everyday counted
 * words ({days}, {items}) through `countOf`, so no sentence carries a digit
 * of its own. Both languages list the same keys.
 */
const STRINGS = {
  en: {
    title: "Your money",
    today: "Today",
    lastDays: "Last {days}",
    whenToday: "today",
    whenLastDays: "in the last {days}",
    failed: "We couldn't load your money figures.",
    cardFailed: "This figure didn't load.",
    retry: "Try again",

    profit: "Net profit",
    estimate: "Estimate",
    loss: "Loss",
    incomplete: "Incomplete",
    profitNone: "No orders {when} to work out your profit from yet.",
    profitOpenRate: "Includes the orders still on the way, at your delivery rate ({rate}).",
    profitOpenNoRate: "Includes the orders still on the way as if every one arrives — there are no deliveries yet to work your rate out from.",
    profitMargin: "You keep {pct} of the sales that were delivered.",
    profitLossWhy: "Shipping, returns and ads cost more than you earned.",
    fromDelivered: "Taken off {amount} of delivered sales",
    fromExpected: "Taken off {amount} of sales delivered or expected to be",
    partCost: "Product cost",
    partShipping: "Shipping",
    partAds: "Ads",
    partReturns: "Returns",
    partFees: "Fees",
    costsMissing: "This profit is incomplete — {items} without a cost",
    costsCoverage: "This profit is incomplete — only {pct} of the pieces delivered have a cost",
    costsMaybe: "{items} in your store without a cost — the real profit may be lower",
    costsMissingShort: "{items} without a cost",
    costsCoverageShort: "Only {pct} of the pieces delivered have a cost",
    moreProducts: "and {n} more",
    completeCosts: "Complete the costs",
    noRealProfit: "We can't tell you your real profit until you enter what your products cost.",
    beforeCost: "Left before product cost",
    beforeCostOpen: "Left before product cost, with the orders still on the way",
    openReport: "Open the profit report",

    held: "Cash with couriers",
    heldOrders_one: "1 order delivered and not collected yet",
    heldOrders_two: "{n} orders delivered and not collected yet",
    heldOrders_few: "{n} orders delivered and not collected yet",
    heldOrders_other: "{n} orders delivered and not collected yet",
    heldNone: "No courier is holding your money right now.",
    heldOldest: "Oldest uncollected cash is with {carrier}, from {age} ago",
    heldAges: "How long it has been with them",
    heldUpTo7: "Up to a week",
    heldUpTo14: "One to two weeks",
    heldOver14: "Over two weeks",
    heldAction: "See who has your money",

    settled: "Collected this week",
    settledFrom_one: "From 1 settlement confirmed this week",
    settledFrom_two: "From {n} settlements confirmed this week",
    settledFrom_few: "From {n} settlements confirmed this week",
    settledFrom_other: "From {n} settlements confirmed this week",
    settledLast: "Nothing confirmed this week — the last settlement was {age} ago.",
    settledNever: "No settlement confirmed yet. Record the first transfer a courier sends you.",
    draft_one: "1 draft settlement is waiting for you to confirm",
    draft_two: "{n} draft settlements are waiting for you to confirm",
    draft_few: "{n} draft settlements are waiting for you to confirm",
    draft_other: "{n} draft settlements are waiting for you to confirm",
    draftSome: "Draft settlements are waiting for you to confirm",
    settledNet: "What reached you, after courier fees",
    settledCollected: "Collected from customers",
    settledFees: "Courier fees",
    settledAction: "Open settlements",
  },
  ar: {
    title: "فلوسك",
    today: "النهارده",
    lastDays: "آخر {days}",
    whenToday: "النهارده",
    whenLastDays: "في آخر {days}",
    failed: "معرفناش نجيب أرقام فلوسك.",
    cardFailed: "الرقم ده ما اتحمّلش.",
    retry: "جرّب تاني",

    profit: "صافي الربح",
    estimate: "تقديري",
    loss: "خسارة",
    incomplete: "ناقص",
    profitNone: "لسه مفيش أوردرات {when} نحسب منها ربحك.",
    profitOpenRate: "شامل الأوردرات اللي لسه في الطريق بنسبة التسليم بتاعتك ({rate}).",
    profitOpenNoRate: "شامل الأوردرات اللي لسه في الطريق على إنها كلها هتتسلّم — لسه مفيش تسليمات نحسب منها نسبتك.",
    profitMargin: "بيفضلّك {pct} من مبيعات الأوردرات اللي اتسلّمت.",
    profitLossWhy: "الشحن والمرتجعات والإعلانات أكتر من اللي كسبته.",
    fromDelivered: "اتخصم من {amount} مبيعات اتسلّمت",
    fromExpected: "اتخصم من {amount} مبيعات اتسلّمت أو متوقّع تتسلّم",
    partCost: "تكلفة المنتج",
    partShipping: "الشحن",
    partAds: "الإعلانات",
    partReturns: "المرتجعات",
    partFees: "الرسوم",
    costsMissing: "الربح ده ناقص — {items} من غير تكلفة",
    costsCoverage: "الربح ده ناقص — {pct} بس من القطع اللي اتسلّمت ليها تكلفة",
    costsMaybe: "{items} في متجرك من غير تكلفة — الربح الحقيقي ممكن يطلع أقل",
    costsMissingShort: "{items} من غير تكلفة",
    costsCoverageShort: "{pct} بس من القطع اللي اتسلّمت ليها تكلفة",
    moreProducts: "و{n} كمان",
    completeCosts: "كمّل التكاليف",
    noRealProfit: "مش هنقدر نقولك ربحك الحقيقي لحد ما تكتب تكلفة المنتجات.",
    beforeCost: "الباقي قبل تكلفة المنتج",
    beforeCostOpen: "الباقي قبل تكلفة المنتج، شامل الأوردرات اللي لسه في الطريق",
    openReport: "افتح تقرير الربح",

    held: "فلوس مع شركات الشحن",
    heldOrders_one: "أوردر واحد متسلّم ولسه ما اتحصّلش",
    heldOrders_two: "أوردرين متسلّمين ولسه ما اتحصّلوش",
    heldOrders_few: "{n} أوردرات متسلّمة ولسه ما اتحصّلتش",
    heldOrders_other: "{n} أوردر متسلّم ولسه ما اتحصّلش",
    heldNone: "مفيش فلوس ليك عند شركات الشحن دلوقتي.",
    heldOldest: "أقدم تحصيل مع {carrier} من {age}",
    heldAges: "بقالها معاهم قد إيه",
    heldUpTo7: "لحد أسبوع",
    heldUpTo14: "من أسبوع لأسبوعين",
    heldOver14: "أكتر من أسبوعين",
    heldAction: "شوف فلوسك مع مين",

    settled: "اتحصّل الأسبوع ده",
    settledFrom_one: "من تسوية واحدة اتأكدت الأسبوع ده",
    settledFrom_two: "من تسويتين اتأكدوا الأسبوع ده",
    settledFrom_few: "من {n} تسويات اتأكدت الأسبوع ده",
    settledFrom_other: "من {n} تسوية اتأكدت الأسبوع ده",
    settledLast: "مفيش تسويات اتأكدت الأسبوع ده — آخر واحدة من {age}.",
    settledNever: "لسه ما أكّدتش أي تسوية. سجّل أول تحويل يوصلك من شركة الشحن.",
    draft_one: "تسوية مسودة مستنية تأكيدك",
    draft_two: "تسويتين مسودة مستنيين تأكيدك",
    draft_few: "{n} تسويات مسودة مستنية تأكيدك",
    draft_other: "{n} تسوية مسودة مستنية تأكيدك",
    draftSome: "فيه تسويات مسودة مستنية تأكيدك",
    settledNet: "اللي وصلك بعد رسوم شركات الشحن",
    settledCollected: "اتحصّل من العملاء",
    settledFees: "رسوم شركات الشحن",
    settledAction: "افتح التسويات",
  },
} satisfies Messages;

/**
 * Below this share of delivered pieces with a known cost, a profit figure would
 * mislead, so the card does not call what is left "profit" (the rule the home
 * has always had).
 */
const MIN_COST_COVERAGE = 80;
/** Cash a courier has held for longer than this is late: the line turns amber. */
const LATE_DAYS = 14;
/** How often the row asks again while the page stays open. */
const REFRESH_MS = 10 * 60_000;

/**
 * A phone: two columns — the profit card across both, then the two cards after it side by side, each
 * in its short form (`compact` on MoneyCard). A card that is not one of that pair takes the whole row.
 * From md up: one row, a column per card, as it has always been.
 */
const GRID = "grid grid-cols-2 gap-[var(--bento-gap)]";
const COLUMNS = ["", "md:grid-cols-1", "md:grid-cols-2", "md:grid-cols-3"] as const;
/** The row's height from md up, held by the skeleton and by every card, so nothing below moves. */
const ROW_HEIGHT = "md:min-h-80";
const SENTENCE = "mt-1.5 text-[13px] leading-5 text-pretty text-ink-soft";
/**
 * The one sentence a card of the phone's pair has room for under its figure. Two short lines in the
 * usual case; the clamp is at three, so the longest of them («… آخر واحدة من ٣ أسابيع.») keeps its end.
 */
const COMPACT_LINE = "max-md:line-clamp-3 max-md:text-xs max-md:leading-4";

/** Tiles round to the whole pound, as the home always has; exact amounts live on the reports. */
const money = (amount: number, currency: string) => formatMinorMoney(Math.round(amount / 100) * 100, currency);
/** A minus in front of an amount below zero, the way the home has always written a loss. */
const signed = (amount: number, currency: string) => `${amount < 0 ? "−" : ""}${money(Math.abs(amount), currency)}`;
/** A name inside a sentence of the other script keeps its own direction (Unicode FSI … PDI). */
const isolate = (text: string) => `\u2068${text}\u2069`;

/* ------------------------------------------------------------------ *
 * Data
 * ------------------------------------------------------------------ */

/** One call's answer: there, refused for this role (403), or failed for another reason. */
type Part<T> = { state: "ok"; value: T } | { state: "denied" } | { state: "failed" };

function settle<T>(result: PromiseSettledResult<T>): Part<T> {
  if (result.status === "fulfilled") return { state: "ok", value: result.value };
  return { state: isPermissionError(result.reason) ? "denied" : "failed" };
}

interface ProfitAnswer {
  pnl: ProfitPnl;
  /** Products with a variant that has no cost. Null: not needed (costs are complete) or it did not load. */
  missing: ProfitEconomicsProduct[] | null;
}

interface MoneyData {
  /** The range the profit answers; the section draws itself from this, never from a newer prop. */
  range: HomeRange;
  profit: Part<ProfitAnswer>;
  held: Part<StatementHeld>;
  settled: Part<SettlementListResponse>;
  drafts: Part<SettlementListResponse>;
}

/**
 * The range's profit, then — only when that profit may be missing a cost — the
 * products that have none. A range whose delivered pieces all had a cost needs
 * no second request.
 */
async function loadProfit(workspaceId: string, range: HomeRange): Promise<ProfitAnswer> {
  const pnl = await profitGetPnl(apiClient, workspaceId, homeWindow(range));
  const { delivered, returned, open } = pnl.totals.orders;
  const complete = pnl.costCoverage !== null && pnl.costCoverage >= 100;
  if (complete || delivered + returned + open === 0) return { pnl, missing: null };
  try {
    const { products } = await profitGetEconomics(apiClient, workspaceId);
    return { pnl, missing: products.filter((product) => product.variantsWithoutCost > 0) };
  } catch {
    // The profit still shows; the strip then speaks from the coverage alone.
    return { pnl, missing: null };
  }
}

/** One loader for the row (home-data-map.md §C); a call that fails takes only its own card with it. */
async function loadMoney(workspaceId: string, range: HomeRange): Promise<MoneyData> {
  const results = await Promise.allSettled([
    loadProfit(workspaceId, range),
    statementGetHeld(apiClient, workspaceId),
    apiClient.listSettlements(workspaceId, { status: "confirmed", limit: 100 }),
    apiClient.listSettlements(workspaceId, { status: "draft", limit: 5 }),
  ]);
  const rejected = results.filter((result): result is PromiseRejectedResult => result.status === "rejected");
  if (rejected.length === results.length) {
    // All refused: this role does not see money. One real failure among them: an error, with a retry.
    throw (rejected.find((result) => !isPermissionError(result.reason)) ?? rejected[0]).reason;
  }
  const [profit, held, settled, drafts] = results;
  return { range, profit: settle(profit), held: settle(held), settled: settle(settled), drafts: settle(drafts) };
}

/* ------------------------------------------------------------------ *
 * The card
 * ------------------------------------------------------------------ */

type Tone = "brand" | "warn" | "bad";

/** The lead icon's chip on a solid card. On glass, glass/home-cards.css re-tints it through data-tone. */
const ICON_TONE: Record<Tone, string> = {
  brand: "bg-primary-soft text-primary",
  warn: "bg-accent-soft text-accent-dark",
  bad: "bg-danger-soft text-danger",
};

interface MoneyCardProps {
  label: string;
  icon: IconComponent;
  tone?: Tone;
  /** Small pills after the label: «تقديري», «خسارة». */
  chips?: ReactNode;
  children: ReactNode;
  /** The card's one action, at its end. A `CardLink` there makes the whole card open its page. */
  footer?: ReactNode;
  /** The footer is a `CardLink`: the card answers the pointer as something that opens. */
  linked?: boolean;
  /**
   * One of the pair that shares a phone's row: half the width, so tighter padding, a smaller chip
   * and a label that may take two lines. Without it the card takes the phone's whole row. From md
   * up it changes nothing.
   */
  compact?: boolean;
  /**
   * With `compact`, below md: the footer's pill is not drawn and this link, laid over the whole
   * card, is the action instead — one target, one tab stop, the same words read out. From md up
   * the footer shows as always and this is not there.
   */
  cover?: { to: string; label: string };
  className?: string;
}

/**
 * One card of «فلوسك»: a duotone icon chip and a quiet label, the figure, a
 * sentence, and one action pinned to the end. The shared Card, so the glass
 * layer makes it a pane; the `data-money-card` hook is for the pieces drawn on
 * it (glass/home-cards.css). A size container, so the figure can step down
 * with the card's width instead of breaking an amount in two.
 */
function MoneyCard({
  label,
  icon: Icon,
  tone = "brand",
  chips,
  children,
  footer,
  linked = false,
  compact = false,
  cover,
  className,
}: MoneyCardProps) {
  return (
    <Card
      data-money-card=""
      data-compact={compact ? "" : undefined}
      data-link={linked ? "" : undefined}
      className={cn("@container/money relative h-full gap-0 p-4", compact ? "max-md:p-3" : "max-md:col-span-2", className)}
    >
      <div className={cn("flex min-h-9 items-center gap-2.5", compact && "max-md:gap-2")}>
        <span
          aria-hidden
          data-slot="money-icon"
          data-tone={tone}
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-xl",
            compact && "max-md:size-7 max-md:rounded-[0.625rem]",
            ICON_TONE[tone]
          )}
        >
          <Icon weight="duotone" className={cn("size-5", compact && "max-md:size-4")} />
        </span>
        <h3
          className={cn(
            "min-w-0 flex-1 truncate text-[13px] leading-5 font-medium text-ink-soft",
            // Half a phone's width would cut «فلوس مع شركات الشحن» short on one line: there it may take two.
            compact && "max-md:line-clamp-2 max-md:text-xs max-md:leading-4 max-md:whitespace-normal"
          )}
          title={label}
        >
          {label}
        </h3>
        {chips}
      </div>
      {children}
      {footer && <div className={cn("mt-auto flex min-w-0 pt-4 max-md:pt-3", compact && cover && "max-md:hidden")}>{footer}</div>}
      {compact && cover && (
        <ViewLink
          to={cover.to}
          data-slot="money-cover"
          className="absolute inset-0 rounded-(--radius-card) focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary md:hidden"
        >
          <span className="sr-only">{cover.label}</span>
        </ViewLink>
      )}
    </Card>
  );
}

/** The big figure: 28px, stepping down to 22px in a narrow card — which a card of the phone's pair always is. */
function Figure({ children, bad = false, compact = false }: { children: ReactNode; bad?: boolean; compact?: boolean }) {
  return (
    <p
      data-slot="money-figure"
      className={cn(
        "mt-3 min-h-9 min-w-0 text-[length:clamp(1.375rem,9cqi,1.75rem)] leading-9 font-semibold tracking-tight wrap-anywhere tabular-nums max-md:mt-2",
        compact && "max-md:min-h-7 max-md:text-[1.375rem] max-md:leading-7",
        bad ? "text-danger" : "text-ink"
      )}
    >
      <bdi dir="ltr">{children}</bdi>
    </p>
  );
}

function Chip({ tone, children }: { tone: "estimate" | "loss"; children: ReactNode }) {
  return (
    <span
      data-slot="money-chip"
      data-tone={tone}
      className={cn(
        "inline-flex h-6 shrink-0 items-center rounded-full px-2 text-[11px] leading-none font-semibold",
        tone === "loss" ? "bg-danger-soft text-danger" : "bg-accent-soft text-accent-dark"
      )}
    >
      {children}
    </span>
  );
}

/**
 * The card's one action: a small pill at its end whose hit area is the whole
 * card (the `after` layer), so a thumb can land anywhere and the keyboard meets
 * one stop. Links inside the card that lead elsewhere sit above that layer
 * (`relative z-10`). The radius is written without var() on purpose: the glass
 * layer lifts any link whose class names rounded-[var(--radius-card)]. Because
 * the card is the target, the pill is only as tall as it looks on a phone; from
 * md up a coarse pointer still gets its 44px.
 */
function CardLink({ to, dot = false, children }: { to: string; dot?: boolean; children: ReactNode }) {
  return (
    <ViewLink
      to={to}
      data-slot="money-action"
      className="inline-flex min-h-9 max-w-full items-center gap-1.5 rounded-full bg-paper-raised px-3.5 text-[13px] font-semibold text-primary ring-1 ring-line transition-colors duration-(--dur-fade) ease-(--ease-out) hover:bg-paper-sunken after:absolute after:inset-0 after:rounded-(--radius-card) focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-primary motion-reduce:transition-none md:pointer-coarse:min-h-11"
    >
      {dot && <span aria-hidden data-slot="money-dot" className="size-1.5 shrink-0 rounded-full bg-accent" />}
      <span className="min-w-0 truncate">{children}</span>
      <IconCaretLeft aria-hidden weight="bold" className="size-3.5 shrink-0 ltr:rotate-180" />
    </ViewLink>
  );
}

/** A sentence with one slot filled by an element (an amount in its own direction). */
function Filled({ template, slot, children }: { template: string; slot: string; children: ReactNode }) {
  const [before, after = ""] = template.split(`{${slot}}`);
  return (
    <>
      {before}
      {children}
      {after}
    </>
  );
}

interface Amount {
  key: string;
  label: string;
  amount: number;
  /** Amber ink: money that is late. */
  warn?: boolean;
}

/**
 * The small labelled amounts under a card's sentence — what the figure is made
 * of: what came off the sales, how long the couriers have held the cash, what
 * a settlement kept back. One quiet line above them says what they are; they
 * wrap, and never shorten an amount.
 */
function Amounts({ caption, items, currency, className }: { caption: ReactNode; items: Amount[]; currency: string; className?: string }) {
  return (
    <div data-slot="money-parts" className={cn("mt-3 border-t border-line pt-3 max-md:mt-2 max-md:pt-2", className)}>
      <p className="text-[11px] leading-4 text-ink-soft">{caption}</p>
      {/* One line where they fit — a phone's width holds four with the narrower gap — and a second only when they do not. */}
      <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-2 max-md:mt-1.5 max-md:gap-x-4 max-md:gap-y-1.5">
        {items.map((item) => (
          <div key={item.key} className="min-w-0">
            <dt className="text-[11px] leading-4 text-ink-soft">{item.label}</dt>
            <dd className={cn("text-[13px] leading-5 font-semibold tabular-nums", item.warn ? "text-accent-dark" : "text-ink")}>
              <bdi dir="ltr">{money(item.amount, currency)}</bdi>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** A card whose request failed for a reason other than "not for this role": it says so and offers the retry. */
function FailedCard({ label, icon, onRetry, compact = false }: { label: string; icon: IconComponent; onRetry: () => void; compact?: boolean }) {
  const t = useT(STRINGS);
  return (
    <MoneyCard
      label={label}
      icon={icon}
      // No `cover`: the footer is the retry button, and it stays on a phone too.
      compact={compact}
      className={ROW_HEIGHT}
      footer={
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex min-h-11 cursor-pointer items-center rounded-full px-4 text-[13px] font-semibold text-primary ring-1 ring-line-strong transition-colors duration-(--dur-fade) ease-(--ease-out) hover:bg-paper-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
        >
          {t.retry}
        </button>
      }
    >
      <p role="alert" className="mt-3 text-sm leading-6 text-ink-soft max-md:mt-2">
        {t.cardFailed}
      </p>
    </MoneyCard>
  );
}

/* ------------------------------------------------------------------ *
 * 1 — net profit
 * ------------------------------------------------------------------ */

/**
 * What came off the sales to leave that figure, as small labelled amounts:
 * product cost, shipping, ads, returns — and the fees when there are any, so
 * the line adds up to the figure above it.
 */
function TakenOff({ statement, currency, estimated, withCost }: { statement: ProfitStatement; currency: string; estimated: boolean; withCost: boolean }) {
  const t = useT(STRINGS);
  const fees = statement.fees + statement.zimosFees;
  const parts: Amount[] = [];
  if (withCost) parts.push({ key: "cost", label: t.partCost, amount: statement.costOfGoods });
  parts.push({ key: "shipping", label: t.partShipping, amount: statement.shipping });
  parts.push({ key: "ads", label: t.partAds, amount: statement.adSpend });
  parts.push({ key: "returns", label: t.partReturns, amount: statement.returnShipping });
  if (fees > 0) parts.push({ key: "fees", label: t.partFees, amount: fees });
  return (
    <Amounts
      currency={currency}
      items={parts}
      caption={
        <Filled template={estimated ? t.fromExpected : t.fromDelivered} slot="amount">
          <bdi dir="ltr" className="font-semibold text-ink tabular-nums">
            {money(statement.revenue, currency)}
          </bdi>
        </Filled>
      }
    />
  );
}

/**
 * The amber strip inside the profit card: costs are incomplete, which products
 * (up to three, each one tap from its page) and the way to fix it. Always in
 * the card itself — never a toast, never behind a tooltip.
 *
 * Below md it is ONE line: the warning mark, `short` («٣ منتجات من غير تكلفة»)
 * and the pill at the end. The names are drawn from md up only — the pill opens
 * the page that lists every one of them — and a screen reader is still read the
 * whole sentence. The pill there is as tall as it looks (32px); its hit area
 * (the `before` layer) fills the strip's height, 44px.
 */
function CostsStrip({ text, short = text, products }: { text: string; short?: string; products: ProfitEconomicsProduct[] }) {
  const t = useT(STRINGS);
  const shown = products.slice(0, 3);
  const more = products.length - shown.length;
  return (
    <div
      data-slot="money-warn"
      role="note"
      className="relative z-10 mt-3 rounded-2xl bg-accent-soft p-3 text-accent-dark ring-1 ring-accent/30 max-md:mt-2 max-md:flex max-md:items-center max-md:gap-2 max-md:py-1.5 max-md:ps-3 max-md:pe-1.5"
    >
      <p className="flex items-start gap-1.5 text-[13px] leading-5 font-semibold max-md:min-w-0 max-md:flex-1 max-md:items-center">
        <IconWarning aria-hidden weight="fill" className="mt-0.5 size-4 shrink-0 max-md:mt-0" />
        <span className="min-w-0 text-pretty max-md:sr-only">{text}</span>
        <span aria-hidden className="min-w-0 text-pretty md:hidden">
          {short}
        </span>
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2 max-md:contents">
        {shown.map((product) => (
          <ViewLink
            key={product.productId}
            to={`/catalog/${product.productId}`}
            data-slot="money-warn-link"
            className="inline-flex min-h-8 max-w-full items-center rounded-full px-3 text-[13px] font-medium ring-1 ring-accent-dark/30 transition-colors duration-(--dur-fade) ease-(--ease-out) hover:bg-accent/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-dark motion-reduce:transition-none max-md:hidden pointer-coarse:min-h-11"
          >
            <span dir="auto" className="min-w-0 truncate">
              {product.name}
            </span>
          </ViewLink>
        ))}
        {more > 0 && <span className="text-xs font-medium max-md:hidden">{fmt(t.moreProducts, { n: more })}</span>}
        <ViewLink
          to="/profit/costs"
          data-slot="money-warn-action"
          className="ms-auto inline-flex min-h-8 items-center gap-1 rounded-full bg-accent-dark px-3.5 text-[13px] font-semibold text-paper-raised transition-opacity duration-(--dur-fade) ease-(--ease-out) hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-dark motion-reduce:transition-none max-md:relative max-md:shrink-0 max-md:px-3 max-md:before:absolute max-md:before:inset-x-0 max-md:before:-inset-y-1.5 md:pointer-coarse:min-h-11"
        >
          {t.completeCosts}
          <IconCaretLeft aria-hidden weight="bold" className="size-3.5 shrink-0 ltr:rotate-180" />
        </ViewLink>
      </div>
    </div>
  );
}

function ProfitCard({ answer, range }: { answer: ProfitAnswer; range: HomeRange }) {
  const t = useT(STRINGS);
  const { pnl } = answer;
  const { totals, currency } = pnl;
  const coverage = pnl.costCoverage;
  const orderCount = totals.orders.delivered + totals.orders.returned + totals.orders.open;
  // With orders still on the way the figure is the projection: the finished orders plus the open
  // ones at the store's delivery rate. With none, projection and actual are the same statement.
  const estimated = totals.orders.open > 0;
  const statement = estimated ? totals.projected : totals.actual;
  const report = <CardLink to="/profit">{t.openReport}</CardLink>;

  // Nothing sold and nothing spent: there is no profit to state yet.
  if (orderCount === 0 && statement.netProfit === 0) {
    const when = range === "today" ? t.whenToday : fmt(t.whenLastDays, { days: countOf("day", range === "30d" ? 30 : 7) });
    return (
      <MoneyCard label={t.profit} icon={IconProfit} linked footer={report} className={ROW_HEIGHT}>
        <p className="mt-3 text-[15px] leading-6 text-pretty text-ink-soft max-md:mt-2">{fmt(t.profitNone, { when })}</p>
      </MoneyCard>
    );
  }

  const withoutCost = answer.missing ?? [];
  const items = countOf("item", withoutCost.length);
  const coveragePct = coverage === null ? "" : formatPercentValue(coverage / 100, 0);
  // Nothing delivered yet, so no coverage to read — but sales with not one pound of product cost
  // in them, and products on file with no cost: that is the same as a coverage of zero.
  const nothingCosted = coverage === null && withoutCost.length > 0 && statement.costOfGoods === 0 && statement.revenue > 0;
  const tooIncomplete = (coverage !== null && coverage < MIN_COST_COVERAGE) || nothingCosted;
  const incomplete = coverage !== null ? coverage < 100 : withoutCost.length > 0;

  // Too many pieces with no cost: what is left is not profit, and the card does not call it that.
  if (tooIncomplete) {
    const beforeCost = statement.netProfit + statement.costOfGoods;
    return (
      <MoneyCard
        label={t.profit}
        icon={IconProfit}
        tone="warn"
        linked
        chips={<Chip tone="estimate">{t.incomplete}</Chip>}
        footer={report}
        className={ROW_HEIGHT}
      >
        <p className="mt-3 text-[15px] leading-6 font-semibold text-pretty text-ink max-md:mt-2">{t.noRealProfit}</p>
        <p className="mt-3 text-xs leading-4 text-ink-soft max-md:mt-2">{estimated ? t.beforeCostOpen : t.beforeCost}</p>
        <p data-slot="money-figure" className="min-w-0 text-[22px] leading-8 font-semibold tracking-tight wrap-anywhere text-ink tabular-nums">
          <bdi dir="ltr">{signed(beforeCost, currency)}</bdi>
        </p>
        <TakenOff statement={statement} currency={currency} estimated={estimated} withCost={false} />
        <CostsStrip
          text={withoutCost.length > 0 ? fmt(t.costsMissingShort, { items }) : fmt(t.costsCoverageShort, { pct: coveragePct })}
          products={withoutCost}
        />
      </MoneyCard>
    );
  }

  const loss = statement.netProfit < 0;
  let sentence: string | null = null;
  if (estimated) {
    // No delivery history: the API projects as if every open order arrives. Say that, not "your rate".
    sentence =
      pnl.projectionDeliveryRate === null
        ? t.profitOpenNoRate
        : fmt(t.profitOpenRate, { rate: formatPercentValue(pnl.projectionDeliveryRate / 100, 0) });
  } else if (loss) {
    sentence = t.profitLossWhy;
  } else if (statement.margin !== null) {
    sentence = fmt(t.profitMargin, { pct: formatPercentValue(statement.margin / 100, 0) });
  }

  let warning: string | null = null;
  // The same warning in the few words a phone's one line holds (see CostsStrip).
  let warningShort: string | undefined;
  if (incomplete) {
    if (coverage === null) warning = fmt(t.costsMaybe, { items });
    else if (withoutCost.length > 0) warning = fmt(t.costsMissing, { items });
    else warning = fmt(t.costsCoverage, { pct: coveragePct });
    warningShort = withoutCost.length > 0 ? fmt(t.costsMissingShort, { items }) : fmt(t.costsCoverageShort, { pct: coveragePct });
  }

  return (
    <MoneyCard
      label={t.profit}
      icon={IconProfit}
      tone={loss ? "bad" : incomplete ? "warn" : "brand"}
      linked
      chips={
        (estimated || loss) && (
          <>
            {estimated && <Chip tone="estimate">{t.estimate}</Chip>}
            {loss && <Chip tone="loss">{t.loss}</Chip>}
          </>
        )
      }
      footer={report}
      className={ROW_HEIGHT}
    >
      <Figure bad={loss}>{signed(statement.netProfit, currency)}</Figure>
      {sentence && <p className={SENTENCE}>{sentence}</p>}
      <TakenOff statement={statement} currency={currency} estimated={estimated} withCost />
      {warning && <CostsStrip text={warning} short={warningShort} products={withoutCost} />}
    </MoneyCard>
  );
}

/* ------------------------------------------------------------------ *
 * 2 — cash with couriers
 * ------------------------------------------------------------------ */

/** The courier holding the oldest delivered, uncollected order. */
function oldestHolder(carriers: StatementHeldCarrier[]): StatementHeldCarrier | null {
  let oldest: StatementHeldCarrier | null = null;
  let oldestAt = Infinity;
  for (const carrier of carriers) {
    if (!carrier.oldestDeliveredAt) continue;
    const at = new Date(carrier.oldestDeliveredAt).getTime();
    if (Number.isNaN(at) || at >= oldestAt) continue;
    oldest = carrier;
    oldestAt = at;
  }
  return oldest;
}

function HeldCard({ held, now, compact }: { held: StatementHeld; now: number; compact: boolean }) {
  const t = useT(STRINGS);
  const empty = held.totalOrders === 0;
  const oldest = empty ? null : oldestHolder(held.carriers);
  const age = oldest ? waitedFor(oldest.oldestDeliveredAt, now) : null;
  const late = oldest !== null && (hoursSince(oldest.oldestDeliveredAt, now) ?? 0) > LATE_DAYS * 24;
  // The same cash by how long ago it was delivered, every courier together.
  const ages = { upTo7: 0, upTo14: 0, over14: 0 };
  for (const carrier of held.carriers) {
    ages.upTo7 += carrier.buckets.upTo7;
    ages.upTo14 += carrier.buckets.upTo14;
    ages.over14 += carrier.buckets.over14;
  }
  return (
    <MoneyCard
      label={t.held}
      icon={IconCash}
      tone={late ? "warn" : "brand"}
      linked
      compact={compact}
      cover={{ to: "/settlements", label: t.heldAction }}
      footer={<CardLink to="/settlements">{t.heldAction}</CardLink>}
      className={ROW_HEIGHT}
    >
      <Figure compact={compact}>{money(held.totalAmount, held.currency)}</Figure>
      {/* Half a phone's row has room for one line under the figure: the cost of waiting when there is
          one — the count is then read out, not drawn — and this sentence when there is not. */}
      <p className={cn(SENTENCE, compact && (oldest && age ? "max-md:sr-only" : COMPACT_LINE))}>
        {empty ? t.heldNone : pluralOf(t, "heldOrders", held.totalOrders)}
      </p>
      {oldest && age && (
        // The cost of waiting. A pill on one line; the radius is half that line, so a line that wraps stays a soft box.
        // In the phone's pair it is a plain line of the same ink (amber once late): two short lines, three at most.
        <p
          data-slot="money-wait"
          data-late={late ? "" : undefined}
          className={cn(
            "mt-2.5 inline-flex min-h-7 max-w-full items-center gap-1.5 self-start rounded-[0.875rem] px-2.5 py-1 text-xs leading-4 font-medium",
            late ? "bg-accent-soft text-accent-dark" : "bg-paper-sunken text-ink-soft",
            compact && "max-md:mt-1.5 max-md:line-clamp-3 max-md:min-h-0 max-md:rounded-none max-md:bg-transparent max-md:p-0"
          )}
        >
          <IconClock aria-hidden weight={late ? "fill" : "regular"} className={cn("size-3.5 shrink-0", compact && "max-md:hidden")} />
          <span className="min-w-0">{fmt(t.heldOldest, { carrier: isolate(providerName(oldest.carrierCode)), age })}</span>
        </p>
      )}
      {!empty && (
        // From md up, where the row is as tall as the profit card anyway. On a phone the pill above says it in one line.
        <Amounts
          className="hidden md:block"
          currency={held.currency}
          caption={t.heldAges}
          items={[
            { key: "upTo7", label: t.heldUpTo7, amount: ages.upTo7 },
            { key: "upTo14", label: t.heldUpTo14, amount: ages.upTo14 },
            { key: "over14", label: t.heldOver14, amount: ages.over14, warn: ages.over14 > 0 },
          ]}
        />
      )}
    </MoneyCard>
  );
}

/* ------------------------------------------------------------------ *
 * 3 — collected this week
 * ------------------------------------------------------------------ */

function SettledCard({
  settled,
  drafts,
  fallbackCurrency,
  now,
  compact,
}: {
  settled: SettlementListResponse;
  drafts: SettlementListResponse | null;
  fallbackCurrency: string;
  now: number;
  compact: boolean;
}) {
  const t = useT(STRINGS);
  const confirmedAt = (row: SettlementListItem) => new Date(row.confirmedAt ?? row.createdAt).getTime();
  const confirmed = settled.settlements.filter((row) => row.status === "confirmed" && row.confirmedAt !== null);
  const weekStart = startOfWeek(now);
  const thisWeek = confirmed.filter((row) => confirmedAt(row) >= weekStart);
  // A settlement is in the currency of its orders. The sum is of one currency only; a row in another is not added to it.
  const currency = thisWeek[0]?.currency ?? fallbackCurrency;
  const counted = thisWeek.filter((row) => (row.currency ?? fallbackCurrency) === currency);
  const sum = counted.reduce((total, row) => total + row.netAmount, 0);
  const collected = counted.reduce((total, row) => total + row.collectedAmount, 0);
  const fees = counted.reduce((total, row) => total + row.feesAmount, 0);

  let last: SettlementListItem | null = null;
  for (const row of confirmed) if (!last || confirmedAt(row) > confirmedAt(last)) last = row;
  const lastAge = last ? waitedFor(last.confirmedAt, now) : null;

  let sentence: string;
  if (counted.length > 0) sentence = pluralOf(t, "settledFrom", counted.length);
  else if (lastAge) sentence = fmt(t.settledLast, { age: lastAge });
  else sentence = t.settledNever;

  // A draft records nothing until it is confirmed: when one waits, confirming it is the action.
  const draftCount = drafts ? drafts.settlements.length : 0;
  const draftLabel = !drafts || draftCount === 0 ? null : drafts.nextCursor !== null ? t.draftSome : pluralOf(t, "draft", draftCount);

  return (
    <MoneyCard
      label={t.settled}
      icon={IconBank}
      linked
      compact={compact}
      cover={{ to: "/settlements", label: draftLabel ?? t.settledAction }}
      footer={
        <CardLink to="/settlements" dot={draftLabel !== null}>
          {draftLabel ?? t.settledAction}
        </CardLink>
      }
      className={ROW_HEIGHT}
    >
      <Figure compact={compact}>{money(sum, currency)}</Figure>
      {/* Half a phone's row has room for one line under the figure: a draft that waits is the action,
          so it is the line (the sentence is then read out, not drawn); with none, the sentence is. */}
      <p className={cn(SENTENCE, compact && (draftLabel ? "max-md:sr-only" : COMPACT_LINE))}>{sentence}</p>
      {compact && draftLabel && (
        // Drawn only: the link over the card carries the same words for a screen reader.
        <p aria-hidden data-slot="money-draft" className="mt-1.5 flex items-start gap-1.5 text-xs leading-4 font-medium text-accent-dark md:hidden">
          <span data-slot="money-dot" className="mt-[0.3125rem] size-1.5 shrink-0 rounded-full bg-accent" />
          <span className="line-clamp-3 min-w-0">{draftLabel}</span>
        </p>
      )}
      {counted.length > 0 && (
        // From md up, as on the couriers' card: what the customers paid and what the couriers kept of it.
        <Amounts
          className="hidden md:block"
          currency={currency}
          caption={t.settledNet}
          items={[
            { key: "collected", label: t.settledCollected, amount: collected },
            { key: "fees", label: t.settledFees, amount: fees },
          ]}
        />
      )}
    </MoneyCard>
  );
}

/* ------------------------------------------------------------------ *
 * The row
 * ------------------------------------------------------------------ */

/**
 * «فلوسك» — where the money is: the range's net profit (with what was taken
 * off, and the costs that are missing said out loud), the cash couriers are
 * still holding and for how long, and what was collected this week. Profit
 * follows the range; the other two are the state of things now.
 *
 * Reading money is `financial_reports.view`: of the system roles the same three
 * that hold `analytics.view`, so the four known roles without it are not even
 * asked. Anyone else is asked, and a 403 means "not for this role".
 */
export function MoneyRow({ workspaceId, range, role }: HomeSectionProps) {
  const t = useT(STRINGS);
  const now = useNow();
  const allowed = canViewAnalytics(role);
  const cacheKey = `home:money:${workspaceId}:${range}`;
  const { data, error, loading, refresh } = useCachedAsync<MoneyData | null>(
    allowed ? cacheKey : null,
    () => (allowed ? loadMoney(workspaceId, range) : Promise.resolve(null)),
    [workspaceId, range, allowed]
  );

  // Whether the cards on screen are this range's own numbers: only then may a refresh run behind
  // them. After a failure, or with another range's numbers still held, it shows as loading.
  const showing = useRef(false);
  showing.current = !loading && !error && data != null && data.range === range;
  // Money moves while the page is open (an order is delivered, a settlement is confirmed): asked
  // again every REFRESH_MS while the page is visible, and on coming back to it after longer.
  useEffect(() => {
    if (!allowed) return;
    let last = Date.now();
    const ask = () => {
      if (document.visibilityState !== "visible" || Date.now() - last < REFRESH_MS) return;
      last = Date.now();
      void refresh({ silent: showing.current });
    };
    const timer = window.setInterval(ask, 60_000);
    document.addEventListener("visibilitychange", ask);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", ask);
    };
  }, [allowed, refresh]);

  if (!allowed) return null;

  const retry = () => {
    // Forget the half answer first, so the row shows as loading while the new one is on its way.
    invalidateCached(cacheKey);
    void refresh();
  };
  // The note follows the choice while its numbers load; once here, note and profit describe the same range.
  const shownRange = loading || !data ? range : data.range;
  const frame = {
    id: "home-money",
    title: t.title,
    note: shownRange === "today" ? t.today : fmt(t.lastDays, { days: countOf("day", shownRange === "30d" ? 30 : 7) }),
  };

  if (loading) {
    return (
      <HomeSection {...frame}>
        <div className={cn(GRID, COLUMNS[3])}>
          {/* The room the three cards take as they load: on a phone the profit card across the row
              and the pair side by side under it; one row from md up. */}
          <HomeSkeleton gridClassName="max-md:col-span-2" className="h-[19rem] md:h-80" />
          <HomeSkeleton className="h-[8.5rem] md:h-80" />
          <HomeSkeleton className="h-[8.5rem] md:h-80" />
        </div>
      </HomeSection>
    );
  }

  // A refresh that failed behind this range's own numbers leaves them on screen; the next one tries again.
  const failed = Boolean(error) && !(data != null && data.range === range);
  if (failed || !data) {
    if (!failed || isPermissionError(error)) return null;
    return (
      <HomeSection {...frame}>
        <HomeSectionError message={t.failed} retryLabel={t.retry} onRetry={retry} />
      </HomeSection>
    );
  }

  // On a phone the two cards after the profit share a row, each in its short form. One of them
  // alone (the other is not for this role) keeps the whole row and its full form.
  const paired = data.held.state !== "denied" && data.settled.state !== "denied";

  const cards: ReactNode[] = [];
  if (data.profit.state === "ok") cards.push(<ProfitCard key="profit" answer={data.profit.value} range={data.range} />);
  else if (data.profit.state === "failed") cards.push(<FailedCard key="profit" label={t.profit} icon={IconProfit} onRetry={retry} />);

  if (data.held.state === "ok") cards.push(<HeldCard key="held" held={data.held.value} now={now} compact={paired} />);
  else if (data.held.state === "failed") cards.push(<FailedCard key="held" label={t.held} icon={IconCash} onRetry={retry} compact={paired} />);

  if (data.settled.state === "ok") {
    // A settlement stored before the server kept its currency falls back to the store's, as the other two answers give it.
    const fallbackCurrency =
      (data.held.state === "ok" ? data.held.value.currency : null) ?? (data.profit.state === "ok" ? data.profit.value.pnl.currency : null) ?? "EGP";
    cards.push(
      <SettledCard
        key="settled"
        settled={data.settled.value}
        drafts={data.drafts.state === "ok" ? data.drafts.value : null}
        fallbackCurrency={fallbackCurrency}
        now={now}
        compact={paired}
      />
    );
  } else if (data.settled.state === "failed") {
    cards.push(<FailedCard key="settled" label={t.settled} icon={IconBank} onRetry={retry} compact={paired} />);
  }

  // Every part refused: this role does not see money.
  if (cards.length === 0) return null;

  return (
    <HomeSection {...frame}>
      <div className={cn(GRID, COLUMNS[Math.min(cards.length, 3)])}>{cards}</div>
    </HomeSection>
  );
}
