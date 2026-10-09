import { Fragment, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode, type Ref } from "react";
import { cn } from "@store-builder/ui";
import {
  IconBank,
  IconCaretDown,
  IconCaretLeft,
  IconConfirm,
  IconCourier,
  IconInbox,
  IconLightning,
  IconLostOrders,
  IconNoAnswer,
  IconPackageFailed,
  IconReturns,
  IconSparkle,
  IconStockLow,
  IconSuccess,
  IconTray,
  type IconComponent,
} from "@/components/icons";
import { CopyButton } from "@/components/CopyButton";
import { ViewLink } from "@/components/ViewLink";
import { useWorkspace } from "@/context/WorkspaceContext";
import { isPermissionError } from "@/lib/errors";
import { formatMinorMoney } from "@/lib/format";
import { countOf, pluralOf } from "@/lib/plural";
import { storeUrl } from "@/lib/storeAddress";
import { useCachedAsync } from "@/lib/useCachedAsync";
import { refreshWorkCounts, useWorkCounts } from "@/lib/workCounts";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { HomeSectionError, HomeSkeleton } from "@/pages/home/today/HomeSection";
import { useNow, waitedFor, type HomeSectionProps } from "@/pages/home/today/homeTime";
import {
  ABANDONED_WINDOW_DAYS,
  loadWorkQueue,
  queueFacts,
  rankQueue,
  type QueueItem,
  type QueueKind,
  type WorkQueueData,
} from "@/pages/home/today/workQueueData";

/*
 * Egyptian Arabic, second person, short. A counted sentence is named after its
 * kind (`<kind>_one/_two/_few/_other`, lib/plural.ts), so a row picks its words
 * by the kind alone. English only needs _one and _other.
 */
const STRINGS = {
  en: {
    title: "Waiting for you now",
    total_one: "1 thing is waiting",
    total_other: "{n} things are waiting",
    totalMore: "{n} or more things are waiting",
    totalPlus: "{n}+",

    calls_one: "1 order is waiting for a confirmation call",
    calls_other: "{n} orders are waiting for a confirmation call",
    callsSome: "Orders are waiting for a confirmation call",
    follow_one: "1 order needs a follow-up",
    follow_other: "{n} orders need a follow-up",
    ship_one: "1 confirmed order has no courier yet",
    ship_other: "{n} confirmed orders have no courier yet",
    failed_one: "1 delivery failed",
    failed_other: "{n} deliveries failed",
    returnsReview_one: "1 return is waiting for your decision",
    returnsReview_other: "{n} returns are waiting for your decision",
    returnsReceive_one: "1 approved return is waiting to be received",
    returnsReceive_other: "{n} approved returns are waiting to be received",
    transfers_one: "1 transfer is waiting for your approval",
    transfers_other: "{n} transfers are waiting for your approval",
    transfersCap: "{n} or more transfers are waiting for your approval",
    stock_one: "1 variant is out of stock or about to run out",
    stock_other: "{n} variants are out of stock or about to run out",
    messages_one: "1 conversation has new messages",
    messages_other: "{n} conversations have new messages",
    abandoned_one: "1 lost order has not been followed up",
    abandoned_other: "{n} lost orders have not been followed up",
    abandonedCap: "{n} or more lost orders have not been followed up",

    leadMany: "Oldest:",
    leadOne: "Waiting since",
    since: "{age} ago",
    worth: "worth {amount}",
    worthAtLeast: "worth at least {amount}",
    lastDays: "in the last {days}",
    andMore: "{names} and more",
    listSep: ", ",
    spokenSep: ". ",

    ctaCalls: "Start calling",
    ctaFollow: "Follow up",
    ctaShip: "Book the courier",
    ctaReview: "Review",
    ctaReceive: "Receive",
    ctaStock: "Restock",
    ctaReply: "Reply",
    ctaRecover: "Win them back",

    more: "{n} more",
    notDue_one: "1 order is not confirmed yet: its call is booked for later or someone is on it.",
    notDue_other: "{n} orders are not confirmed yet: their calls are booked for later or someone is on them.",
    partFailed: "Part of this list didn't load.",
    retry: "Try again",
    loadFailed: "We couldn't load what's waiting for you. This isn't an all-clear — try again.",

    allClear: "Nothing is waiting for you right now — every order is confirmed and on its way.",
    clear: "Nothing is waiting for you right now.",
    queueClear: "No calls are waiting for you right now.",
    allOrders: "All orders",
    first: "No orders yet",
    firstBody: "Your first order will show up here with its next step. Share your store link to bring it in.",
    firstAction: "Copy your store link",
  },
  ar: {
    title: "مستنيك دلوقتي",
    total_one: "حاجة واحدة مستنياك",
    total_two: "حاجتين مستنيينك",
    total_few: "{n} حاجات مستنياك",
    total_other: "{n} حاجة مستنياك",
    totalMore: "{n} حاجة أو أكتر مستنياك",
    totalPlus: "{n}+",

    calls_one: "أوردر واحد مستني مكالمة تأكيد",
    calls_two: "أوردرين مستنيين مكالمة تأكيد",
    calls_few: "{n} أوردرات مستنية مكالمة تأكيد",
    calls_other: "{n} أوردر مستني مكالمة تأكيد",
    callsSome: "فيه أوردرات مستنية مكالمة تأكيد",
    follow_one: "أوردر واحد محتاج متابعة",
    follow_two: "أوردرين محتاجين متابعة",
    follow_few: "{n} أوردرات محتاجة متابعة",
    follow_other: "{n} أوردر محتاج متابعة",
    ship_one: "أوردر واحد متأكد من غير مندوب",
    ship_two: "أوردرين متأكدين من غير مندوب",
    ship_few: "{n} أوردرات متأكدة من غير مندوب",
    ship_other: "{n} أوردر متأكد من غير مندوب",
    failed_one: "أوردر واحد التوصيل فشل فيه",
    failed_two: "أوردرين التوصيل فشل فيهم",
    failed_few: "{n} أوردرات التوصيل فشل فيها",
    failed_other: "{n} أوردر التوصيل فشل فيه",
    returnsReview_one: "مرتجع واحد مستني قرارك",
    returnsReview_two: "مرتجعين مستنيين قرارك",
    returnsReview_few: "{n} مرتجعات مستنية قرارك",
    returnsReview_other: "{n} مرتجع مستني قرارك",
    returnsReceive_one: "مرتجع واحد مستني تستلمه",
    returnsReceive_two: "مرتجعين مستنيين تستلمهم",
    returnsReceive_few: "{n} مرتجعات مستنية تستلمها",
    returnsReceive_other: "{n} مرتجع مستني تستلمه",
    transfers_one: "تحويل واحد مستني موافقتك",
    transfers_two: "تحويلين مستنيين موافقتك",
    transfers_few: "{n} تحويلات مستنية موافقتك",
    transfers_other: "{n} تحويل مستني موافقتك",
    transfersCap: "{n} تحويل أو أكتر مستنيين موافقتك",
    stock_one: "نوع واحد خلص أو قرّب يخلص",
    stock_two: "نوعين خلصوا أو قرّبوا يخلصوا",
    stock_few: "{n} أنواع خلصت أو قرّبت تخلص",
    stock_other: "{n} نوع خلص أو قرّب يخلص",
    messages_one: "محادثة واحدة فيها رسايل جديدة",
    messages_two: "محادثتين فيهم رسايل جديدة",
    messages_few: "{n} محادثات فيها رسايل جديدة",
    messages_other: "{n} محادثة فيها رسايل جديدة",
    abandoned_one: "أوردر واحد مفقود محدش تابعه",
    abandoned_two: "أوردرين مفقودين محدش تابعهم",
    abandoned_few: "{n} أوردرات مفقودة محدش تابعها",
    abandoned_other: "{n} أوردر مفقود محدش تابعه",
    abandonedCap: "{n} أوردر مفقود أو أكتر محدش تابعهم",

    leadMany: "أقدمهم",
    leadOne: "مستني",
    since: "من {age}",
    worth: "بقيمة {amount}",
    worthAtLeast: "بقيمة {amount} على الأقل",
    lastDays: "في آخر {days}",
    andMore: "{names} وغيرهم",
    listSep: "، ",
    spokenSep: ". ",

    ctaCalls: "ابدأ الاتصال",
    ctaFollow: "تابع",
    ctaShip: "احجز المندوب",
    ctaReview: "راجع",
    ctaReceive: "استلم",
    ctaStock: "زوّد المخزون",
    ctaReply: "ردّ",
    ctaRecover: "رجّعهم",

    more: "كمان {n}",
    notDue_one: "أوردر واحد لسه ما اتأكدش: مكالمته متأجلة لبعدين أو حد شغّال عليها.",
    notDue_two: "أوردرين لسه ما اتأكدوش: مكالماتهم متأجلة لبعدين أو حد شغّال عليها.",
    notDue_few: "{n} أوردرات لسه ما اتأكدتش: مكالماتها متأجلة لبعدين أو حد شغّال عليها.",
    notDue_other: "{n} أوردر لسه ما اتأكدش: مكالماتهم متأجلة لبعدين أو حد شغّال عليها.",
    partFailed: "جزء من القايمة مجاش.",
    retry: "جرّب تاني",
    loadFailed: "معرفناش نجيب اللي مستنيك. ده مش معناه إن مفيش حاجة — جرّب تاني.",

    allClear: "مفيش حاجة مستنياك دلوقتي — كل الأوردرات متأكدة وفي طريقها.",
    clear: "مفيش حاجة مستنياك دلوقتي.",
    queueClear: "مفيش مكالمات مستنياك دلوقتي.",
    allOrders: "كل الأوردرات",
    first: "لسه مفيش أوردرات",
    firstBody: "أول أوردر هيظهر هنا ومعاه الخطوة الجاية. شارك لينك متجرك عشان ييجي.",
    firstAction: "انسخ لينك متجرك",
  },
} satisfies Messages;

type StringKey = keyof (typeof STRINGS)["en"];
type Strings = Record<StringKey, string>;

/** The icon of a kind and the button that starts its work. */
const KINDS: Record<QueueKind, { icon: IconComponent; cta: StringKey }> = {
  calls: { icon: IconConfirm, cta: "ctaCalls" },
  follow: { icon: IconNoAnswer, cta: "ctaFollow" },
  transfers: { icon: IconBank, cta: "ctaReview" },
  failed: { icon: IconPackageFailed, cta: "ctaFollow" },
  ship: { icon: IconCourier, cta: "ctaShip" },
  messages: { icon: IconInbox, cta: "ctaReply" },
  returnsReview: { icon: IconReturns, cta: "ctaReview" },
  returnsReceive: { icon: IconTray, cta: "ctaReceive" },
  abandoned: { icon: IconLostOrders, cta: "ctaRecover" },
  stock: { icon: IconStockLow, cta: "ctaStock" },
};

/** More kinds than this fold behind «كمان {n}», so six rows never read as a wall. */
const VISIBLE = 5;
const REFRESH_MS = 120_000;

/** The card rounds to the whole pound, as every tile of the home does; exact amounts live on the order. */
const money = (amount: number, currency: string) => formatMinorMoney(Math.round(amount / 100) * 100, currency);
const num = (n: number) => fmt("{n}", { n });

/* The space the queue held last time, so the page below does not jump while it loads. Below md a
   row is 72px (see QueueRow), so the same number of rows holds less room there. */
const SKELETON_HEIGHT = [
  "h-[4.5rem]",
  "h-[10.5rem] max-md:h-[9.5rem] xl:h-[9.5rem]",
  "h-[16.5rem] max-md:h-[15rem] xl:h-[9.5rem]",
  "h-[22.5rem] max-md:h-[20.5rem] xl:h-[14.25rem]",
  "h-[28.5rem] max-md:h-[26rem] xl:h-[14.25rem]",
  "h-[34.5rem] max-md:h-[31.5rem] xl:h-[19rem]",
  "h-[38.5rem] max-md:h-[35rem] xl:h-[19rem]",
];
const rowsKey = (workspaceId: string) => `zimos.home.queue.rows.${workspaceId}`;

function rememberedRows(workspaceId: string): number {
  try {
    const raw = window.localStorage.getItem(rowsKey(workspaceId));
    const rows = raw === null ? NaN : Number(raw);
    return Number.isInteger(rows) && rows >= 0 && rows < SKELETON_HEIGHT.length ? rows : 3;
  } catch {
    return 3;
  }
}

function rememberRows(workspaceId: string, rows: number) {
  try {
    window.localStorage.setItem(rowsKey(workspaceId), String(Math.min(rows, SKELETON_HEIGHT.length - 1)));
  } catch {
    /* private mode: the skeleton keeps its default height */
  }
}

function sentenceOf(item: QueueItem, t: Strings): string {
  if (item.count === null) return t.callsSome;
  if (item.capped && item.kind === "transfers") return fmt(t.transfersCap, { n: item.count });
  if (item.capped && item.kind === "abandoned") return fmt(t.abandonedCap, { n: item.count });
  return pluralOf(t, item.kind, item.count);
}

/** A sentence with one piece drawn as a node: `"worth {amount}"` → ["worth ", <node>, ""]. */
function around(template: string, key: string, node: ReactNode): ReactNode {
  const [before, after = ""] = template.split(`{${key}}`);
  return (
    <span>
      {before}
      {node}
      {after}
    </span>
  );
}

/**
 * The cost of waiting, under the sentence: how long the oldest has waited and
 * the money in it, when the API gives them. `spoken` is the same line as plain
 * words for the row's accessible name.
 */
function costOf(item: QueueItem, t: Strings, now: number): { parts: ReactNode[]; spoken: string[] } {
  const parts: ReactNode[] = [];
  const spoken: string[] = [];
  // A kind the API gives no age for has no `since`. The age is that of the oldest one — for a failed
  // delivery, of the oldest ORDER (when it was placed), which is all the API says (needs-backend H4).
  const age = waitedFor(item.since, now);
  if (age) {
    const lead = item.count === 1 ? t.leadOne : t.leadMany;
    const since = fmt(t.since, { age });
    spoken.push(`${lead} ${since}`);
    parts.push(
      // Two pieces, so a narrow row breaks between «أقدمهم» and «من ٣ ساعات», never inside them.
      <span className="inline-flex min-w-0 flex-wrap items-center gap-x-1 gap-y-1">
        <span>{lead}</span>
        {item.level >= 2 ? (
          // Late (four hours and more): the age sits in an amber chip so the eye lands on it.
          <span
            data-slot="queue-late"
            className="zimos-queue-late inline-flex min-h-[1.375rem] items-center rounded-full bg-accent px-2 text-xs leading-5 font-semibold whitespace-nowrap text-accent-foreground"
          >
            {since}
          </span>
        ) : (
          <span className="whitespace-nowrap">{since}</span>
        )}
      </span>
    );
  }
  if (item.kind === "abandoned") {
    const recent = fmt(t.lastDays, { days: countOf("day", ABANDONED_WINDOW_DAYS) });
    spoken.push(recent);
    parts.push(recent);
  }
  if (item.amount !== null && item.amount > 0 && item.currency) {
    const amount = money(item.amount, item.currency);
    const template = item.exact ? t.worth : t.worthAtLeast;
    spoken.push(fmt(template, { amount }));
    parts.push(
      around(
        template,
        "amount",
        <bdi dir="ltr" className="tabular-nums">
          {amount}
        </bdi>
      )
    );
  }
  if (item.names.length > 0) {
    const joined = item.names.join(t.listSep);
    spoken.push(item.moreNames ? fmt(t.andMore, { names: joined }) : joined);
    const names = item.names.map((name, i) => (
      <Fragment key={name}>
        {i > 0 && t.listSep}
        <bdi>{name}</bdi>
      </Fragment>
    ));
    // A product name is the merchant's own text: it may be one long word, so it may break anywhere.
    parts.push(<span className="[overflow-wrap:anywhere]">{item.moreNames ? around(t.andMore, "names", names) : names}</span>);
  }
  return { parts, spoken };
}

/**
 * One kind of work: a frosted pill on the card that is one link to the screen
 * that clears it. The white pill at its end is what the eye reads as the
 * button; the whole row is the target (one tab stop, 64px and more).
 *
 * Narrow (a phone): the sentence, then the cost of waiting with the pill at
 * the end of that line — the pill drops under, full width, when the two do not
 * fit. From 28rem of row: the pill sits at the end, centred on both lines.
 *
 * Below md the row is kept to 72px: a 36px chip, a 22px sentence line, and the
 * pill — still 32px to the eye — reaching 4px above and below the cost line it
 * sits on (into the gap over it and the row's own padding under it) instead of
 * making that line 32px tall. The pill is a picture of a button, not a target:
 * the target is the row, so it is never less than 44px.
 */
function QueueRow({
  item,
  index,
  span,
  now,
  t,
  linkRef,
}: {
  item: QueueItem;
  index: number;
  span: boolean;
  now: number;
  t: Strings;
  linkRef?: Ref<HTMLAnchorElement>;
}) {
  const kind = KINDS[item.kind];
  const KindIcon = kind.icon;
  const late = item.level >= 2;
  const sentence = sentenceOf(item, t);
  const cost = costOf(item, t, now);
  const hasCost = cost.parts.length > 0;
  const cta = t[kind.cta];

  const action = (
    <span
      data-slot="queue-action"
      className={cn(
        "zimos-queue-action inline-flex min-h-8 items-center justify-center gap-1 rounded-full bg-paper-raised px-3 text-[13px] leading-5 font-semibold whitespace-nowrap text-primary-dark max-md:-my-1 dark:text-ink",
        "@md/row:col-start-2 @md/row:row-span-2 @md/row:row-start-1 @md/row:min-h-9 @md/row:flex-none @md/row:px-3.5",
        hasCost ? "flex-[1_0_auto]" : "flex-none"
      )}
    >
      {cta}
      <IconCaretLeft
        weight="bold"
        aria-hidden
        className="size-3.5 transition-[translate] duration-(--dur-fade) ease-(--ease-out) motion-reduce:transition-none ltr:rotate-180 ltr:group-hover/row:translate-x-0.5 rtl:group-hover/row:-translate-x-0.5 motion-reduce:group-hover/row:translate-x-0"
      />
    </span>
  );

  return (
    <li
      className={cn("@container/row flex min-w-0", span && "@4xl/queue:col-span-2")}
      style={{ "--hq-i": index } as CSSProperties}
    >
      <ViewLink
        ref={linkRef}
        to={item.to}
        aria-label={[sentence, ...cost.spoken, cta].join(t.spokenSep)}
        data-slot="queue-row"
        data-late={late ? "" : undefined}
        className="zimos-queue-row group/row flex min-h-16 min-w-0 flex-1 items-center gap-2.5 rounded-[1.25rem] border border-primary-foreground/30 px-2.5 py-2.5 @md/row:gap-3 @md/row:px-3 transition-[scale,translate,border-color,box-shadow] duration-(--dur-fade) ease-(--ease-out) hover:-translate-y-0.5 hover:border-primary-foreground/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-foreground active:scale-[0.985] motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100"
      >
        <span
          data-slot="queue-icon"
          className="zimos-queue-icon relative grid size-10 shrink-0 place-items-center rounded-full bg-primary-foreground/15 max-md:size-9"
        >
          <KindIcon weight="fill" className="size-5" aria-hidden />
          {late && (
            <span aria-hidden className="zimos-queue-dot absolute end-0 top-0 size-2.5 rounded-full bg-accent ring-2 ring-primary" />
          )}
        </span>
        <span
          className={cn(
            "min-w-0 flex-1",
            hasCost ? "block" : "flex items-center gap-2",
            "@md/row:grid @md/row:grid-cols-[minmax(0,1fr)_auto] @md/row:items-center @md/row:gap-x-3 @md/row:gap-y-0"
          )}
        >
          <span className="block min-w-0 flex-1 text-[15px] leading-6 font-semibold max-md:leading-[1.375rem] @md/row:col-start-1 @md/row:row-start-1">
            {sentence}
          </span>
          {hasCost ? (
            <span className="mt-1.5 flex flex-wrap items-center gap-2 max-md:mt-1 @md/row:contents">
              <span
                data-slot="queue-cost"
                className="zimos-queue-cost min-w-0 flex-[999_1_6.5rem] overflow-hidden text-[13px] leading-5 @md/row:col-start-1 @md/row:row-start-2 @md/row:mt-0.5"
              >
                {/* Each piece carries its «·» in its own leading gap, and the line is pulled back by that
                    gap: a piece that wraps to a new line starts clean, with no dot left hanging. */}
                <span className="-ms-4 flex flex-wrap items-center gap-y-1">
                  {cost.parts.map((part, i) => (
                    <span key={i} className="relative min-w-0 ps-4 before:absolute before:start-1.5 before:content-['·']">
                      {part}
                    </span>
                  ))}
                </span>
              </span>
              {action}
            </span>
          ) : (
            action
          )}
        </span>
      </ViewLink>
    </li>
  );
}

/** The section around every state that is not the card itself: it keeps its name, read but not drawn. */
function Frame({ headingId, title, busy, children }: { headingId: string; title: string; busy?: boolean; children: ReactNode }) {
  return (
    <section aria-labelledby={headingId} aria-busy={busy || undefined} className="min-w-0">
      <h2 id={headingId} className="sr-only">
        {title}
      </h2>
      {children}
    </section>
  );
}

/** One calm pane: the state the queue is in when no row is drawn (all clear, first order). */
function CalmRow({
  headingId,
  title,
  icon: CalmIcon,
  tone,
  children,
  action,
}: {
  headingId: string;
  title: string;
  icon: IconComponent;
  tone: "success" | "brand";
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Frame headingId={headingId} title={title}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[var(--radius-card)] bg-paper-raised px-4 py-3 shadow-[var(--shadow-card)] ring-1 ring-line">
        <span
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-full",
            tone === "success" ? "bg-success-soft text-success" : "bg-primary-soft text-primary"
          )}
        >
          <CalmIcon weight="fill" className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-[1_1_14rem] text-ink">{children}</div>
        {action}
      </div>
    </Frame>
  );
}

/**
 * «مستنيك دلوقتي» — the work queue, the one floating card of the home: one row
 * per kind of work that has something waiting, the latest first, each one tap
 * from the screen that clears it. Counts of calls, couriers to book and unread
 * conversations are the shell's shared ones (lib/workCounts.ts); ages and the
 * other kinds come from one loader (workQueueData.ts), refreshed every two
 * minutes and whenever the tab comes back.
 *
 * Three states besides the list, as the old tile had: the store's first order,
 * all clear (a calm pane, not the gradient card), and "couldn't load" — which
 * is never shown as an all-clear.
 */
export function WorkQueue({ workspaceId, role }: HomeSectionProps) {
  const t = useT(STRINGS);
  const headingId = useId();
  const now = useNow();
  const { currentWorkspace } = useWorkspace();
  const counts = useWorkCounts(workspaceId);
  // The WhatsApp connection is only worth asking about while a conversation is unread.
  const askWhatsapp = (counts.unread ?? 0) > 0;
  const queue = useCachedAsync<WorkQueueData>(
    `home:queue:${workspaceId}`,
    () => loadWorkQueue(workspaceId, { role, askWhatsapp }),
    [workspaceId, askWhatsapp]
  );
  const { data, refresh } = queue;

  useEffect(() => {
    const again = () => {
      if (document.visibilityState === "visible") void refresh({ silent: true });
    };
    const timer = window.setInterval(again, REFRESH_MS);
    document.addEventListener("visibilitychange", again);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", again);
    };
  }, [refresh, workspaceId]);

  const items = useMemo(() => (data ? rankQueue(data, counts, now) : []), [data, counts, now]);
  const [expanded, setExpanded] = useState(false);
  const folded = !expanded && items.length > VISIBLE;
  const shown = folded ? items.slice(0, VISIBLE) : items;
  const cells = shown.length + (folded ? 1 : 0);

  // The rows that «كمان» reveals take the focus, so the keyboard stays where the button was.
  const revealRef = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    if (expanded) revealRef.current?.focus();
  }, [expanded]);

  // Rows settle in once per visit; a refresh or a new row afterwards does not replay it.
  const hasRows = items.length > 0;
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    if (!hasRows || entered) return;
    const timer = window.setTimeout(() => setEntered(true), 40 * (VISIBLE + 1) + 420);
    return () => window.clearTimeout(timer);
  }, [hasRows, entered]);

  const loaded = Boolean(data) && !queue.loading;
  useEffect(() => {
    if (loaded) rememberRows(workspaceId, cells);
  }, [loaded, cells, workspaceId]);

  const retry = () => {
    refreshWorkCounts();
    void refresh();
  };

  const failedToLoad = (
    <Frame headingId={headingId} title={t.title}>
      <HomeSectionError message={t.loadFailed} retryLabel={t.retry} onRetry={retry} />
    </Frame>
  );

  // `loading` is true only while there is nothing of THIS store to show (first visit, or the store changed).
  if (queue.loading || !data) {
    if (!queue.loading && queue.error) return isPermissionError(queue.error) ? null : failedToLoad;
    return (
      <Frame headingId={headingId} title={t.title} busy>
        <HomeSkeleton className={SKELETON_HEIGHT[rememberedRows(workspaceId)]} />
      </Frame>
    );
  }

  const facts = queueFacts(data, counts);

  if (!hasRows) {
    // Something did not load: never read that as "nothing to do".
    if (data.incomplete || queue.error) return failedToLoad;
    // A role that reads neither orders nor the queue has nothing to do here.
    if (!facts.ordersReadable && !facts.queueReadable) return null;

    if (facts.noOrdersYet) {
      return (
        <CalmRow
          headingId={headingId}
          title={t.title}
          icon={IconSparkle}
          tone="brand"
          action={
            currentWorkspace?.slug ? (
              <CopyButton
                value={storeUrl(currentWorkspace.slug)}
                label={t.firstAction}
                className="min-h-11 shrink-0 px-4 text-sm font-semibold text-primary ring-1 ring-line-strong hover:text-primary"
              />
            ) : undefined
          }
        >
          <p className="text-[15px] leading-6 font-semibold">{t.first}</p>
          <p className="text-[13px] leading-5 text-ink-soft">{t.firstBody}</p>
        </CalmRow>
      );
    }
    return (
      <CalmRow
        headingId={headingId}
        title={t.title}
        icon={IconSuccess}
        tone="success"
        action={
          facts.ordersReadable ? (
            <ViewLink
              to="/orders"
              className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full px-2 text-[13px] font-medium text-primary hover:text-primary focus-visible:outline-2 focus-visible:outline-primary"
            >
              {t.allOrders}
              <IconCaretLeft className="size-3.5 ltr:rotate-180" weight="bold" aria-hidden />
            </ViewLink>
          ) : undefined
        }
      >
        <p className="text-[15px] leading-6 font-medium">
          {!facts.ordersReadable ? t.queueClear : facts.allConfirmed ? t.allClear : t.clear}
        </p>
        {facts.notDue > 0 && <p className="text-[13px] leading-5 text-ink-soft">{pluralOf(t, "notDue", facts.notDue)}</p>}
      </CalmRow>
    );
  }

  const total = items.reduce((sum, item) => sum + (item.count ?? 0), 0);
  const totalIsFloor = items.some((item) => item.capped || item.count === null);
  const incomplete = data.incomplete || Boolean(queue.error);

  return (
    <section aria-labelledby={headingId} className="min-w-0">
      <div
        data-slot="home-queue"
        className="zimos-queue @container/queue rounded-[1.75rem] bg-primary p-3 text-primary-foreground shadow-[var(--shadow-raised)] sm:p-4"
      >
        <div className="flex min-h-9 items-center gap-2 px-1 pb-3">
          <IconLightning weight="fill" className="size-5 shrink-0" aria-hidden />
          <h2 id={headingId} className="min-w-0 text-[17px] leading-6 font-semibold">
            {t.title}
          </h2>
          <span
            data-slot="queue-total"
            className="zimos-queue-total inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full border border-primary-foreground/40 px-2 text-[13px] leading-none font-semibold tabular-nums"
          >
            <bdi dir="ltr" aria-hidden>
              {totalIsFloor ? fmt(t.totalPlus, { n: total }) : num(total)}
            </bdi>
            <span className="sr-only">{totalIsFloor ? fmt(t.totalMore, { n: total }) : pluralOf(t, "total", total)}</span>
          </span>
        </div>

        <ul role="list" data-enter={entered ? undefined : ""} className="grid grid-cols-1 gap-2 @4xl/queue:grid-cols-2 @4xl/queue:gap-2.5">
          {shown.map((item, index) => (
            <QueueRow
              key={item.kind}
              item={item}
              index={index}
              // An odd number of cells: the latest kind takes the whole first line.
              span={index === 0 && cells % 2 === 1}
              now={now}
              t={t}
              linkRef={expanded && index === VISIBLE ? revealRef : undefined}
            />
          ))}
          {folded && (
            <li className="flex min-w-0" style={{ "--hq-i": VISIBLE } as CSSProperties}>
              <button
                type="button"
                aria-expanded={false}
                onClick={() => setExpanded(true)}
                className="zimos-queue-more flex min-h-12 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-[1.25rem] border border-dashed border-primary-foreground/40 px-3 text-sm font-semibold transition-[scale,background-color,border-color] duration-(--dur-fade) ease-(--ease-out) hover:border-primary-foreground/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-foreground active:scale-[0.985] motion-reduce:transition-none motion-reduce:active:scale-100"
              >
                {fmt(t.more, { n: items.length - VISIBLE })}
                <IconCaretDown weight="bold" className="size-4" aria-hidden />
              </button>
            </li>
          )}
        </ul>

        {(facts.notDue > 0 || incomplete) && (
          <div data-slot="queue-note" className="zimos-queue-note mt-2 px-1 text-[13px] leading-5">
            {facts.notDue > 0 && <p className="pt-1">{pluralOf(t, "notDue", facts.notDue)}</p>}
            {incomplete && (
              <p className="flex flex-wrap items-center gap-x-2">
                {t.partFailed}
                <button
                  type="button"
                  onClick={retry}
                  className="inline-flex min-h-11 cursor-pointer items-center font-semibold underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-foreground"
                >
                  {t.retry}
                </button>
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
