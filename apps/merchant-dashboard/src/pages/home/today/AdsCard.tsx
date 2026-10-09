import { useEffect } from "react";
import { buttonVariants, Card, cn } from "@store-builder/ui";
import { adsConnectionsList, profitGetCampaigns, type ProfitCampaign, type ProfitCampaigns } from "@store-builder/api-client";
import { AdPlatformMark } from "@/components/AdPlatformMark";
import { ViewLink } from "@/components/ViewLink";
import {
  IconAdAccounts,
  IconAds,
  IconAnnounce,
  IconHourglass,
  IconTrendDown,
  IconTrophy,
  type IconComponent,
} from "@/components/icons";
import { AD_PLATFORM_NAMES } from "@/lib/adPlatforms";
import { apiClient } from "@/lib/apiClient";
import { formatCount } from "@/lib/analytics";
import { canViewAnalytics } from "@/lib/analyticsAccess";
import { isPermissionError } from "@/lib/errors";
import { formatMinorMoney } from "@/lib/format";
import { countOf } from "@/lib/plural";
import { useCachedAsync } from "@/lib/useCachedAsync";
import { fmt, useCommon, useT, type Messages } from "@/i18n/LocaleContext";
import { HomeSection, HomeSectionError, HomeSkeleton } from "@/pages/home/today/HomeSection";
import { homeWindow, type HomeRange, type HomeSectionProps } from "@/pages/home/today/homeTime";

/* Egyptian Arabic, second person, short. */
const STRINGS = {
  en: {
    title: "Ads",
    whenToday: "today",
    whenDays: "in the last {days}",
    all: "All campaigns",
    hero: "Cost of a delivered order",
    heroHint: "What you spent on ads, divided by the orders that were actually delivered — not the ones placed.",
    heroNone: "You spent {amount} {when}, and no order that came from the ads has been delivered yet.",
    heroNoneToday: "An order takes a few days to arrive: pick a longer period above.",
    heroNoneLabel: "No delivered order to work the cost out from yet",
    spend: "Spend",
    orders: "Orders",
    delivered: "Delivered",
    best: "Best campaign",
    worst: "Weakest campaign",
    only: "Your one campaign with spend",
    perDelivered: "per delivered order",
    nothingDelivered: "Spent {amount} and not one of its orders was delivered",
    noCompare:
      "No campaign with spend has a delivered order yet, so there is nothing to compare. The best and the weakest campaign will show here once orders arrive.",
    unnamed: "Unnamed campaign",
    connectText: "Connect your ad account to see what a delivered order really costs you.",
    connect: "Connect the account",
    recordText: "No ad spend is recorded {when}. Record it to see what a delivered order costs you.",
    record: "Record ad spend",
    error: "We couldn't load your ad numbers.",
    retry: "Try again",
  },
  ar: {
    title: "الإعلانات",
    whenToday: "النهارده",
    whenDays: "في آخر {days}",
    all: "كل الحملات",
    hero: "تكلفة الأوردر المتسلّم",
    heroHint: "اللي صرفته على الإعلانات مقسوم على الأوردرات اللي اتسلّمت فعلًا، مش اللي اتطلبت.",
    heroNone: "صرفت {amount} {when}، ولسه ما اتسلّمش أي أوردر جه من الإعلانات.",
    heroNoneToday: "الأوردر بياخد كام يوم لحد ما يتسلّم: اختار فترة أطول من فوق.",
    heroNoneLabel: "لسه مفيش أوردر متسلّم نحسب منه التكلفة",
    spend: "الصرف",
    orders: "الأوردرات",
    delivered: "اتسلّم",
    best: "أحسن حملة",
    worst: "أضعف حملة",
    only: "حملتك الوحيدة اللي عليها صرف",
    perDelivered: "للأوردر المتسلّم",
    nothingDelivered: "صرفت {amount} وما اتسلّمش منها ولا أوردر",
    noCompare:
      "لسه ما اتسلّمش أوردر من أي حملة عليها صرف، فمفيش حاجة نقارن بيها. أحسن حملة وأضعف حملة هيظهروا هنا أول ما الأوردرات توصل.",
    unnamed: "حملة من غير اسم",
    connectText: "اربط حساب الإعلانات عشان تعرف الأوردر المتسلّم بيكلّفك كام.",
    connect: "اربط الحساب",
    recordText: "مفيش مصاريف إعلانات متسجّلة {when}. سجّلها عشان تعرف الأوردر المتسلّم بيكلّفك كام.",
    record: "سجّل مصاريف الإعلانات",
    error: "معرفناش نحمّل أرقام الإعلانات.",
    retry: "جرّب تاني",
  },
} satisfies Messages;

interface AdsData {
  /** What the answer belongs to: a cached answer for another range is never drawn under this one's label. */
  key: string;
  report: ProfitCampaigns;
  /** An ad account is linked and working. False too when the connections could not be read. */
  connected: boolean;
}

type RowTone = "best" | "worst" | "only";

interface CampaignPick {
  tone: RowTone;
  campaign: ProfitCampaign;
}

/**
 * The campaigns worth naming, by what a delivered order cost in each
 * (`realCpa` = spend ÷ delivered), among the campaigns that spent anything.
 * A campaign that spent and delivered nothing has no such cost: it is the
 * weakest. With one campaign there is nothing to rank — it is shown once.
 * Null while no campaign with spend has a delivered order at all: every one
 * of them would be "the weakest", so nothing is ranked until orders arrive.
 */
function pickCampaigns(report: ProfitCampaigns): CampaignPick[] | null {
  const spenders = report.campaigns.filter((campaign) => campaign.spendAmount > 0);
  if (spenders.every((campaign) => campaign.realCpa === null)) return null;
  if (spenders.length === 1) return [{ tone: "only", campaign: spenders[0] }];

  const rated = spenders
    .filter((campaign) => campaign.realCpa !== null)
    .sort((a, b) => (a.realCpa ?? 0) - (b.realCpa ?? 0));
  const unrated = spenders.filter((campaign) => campaign.realCpa === null).sort((a, b) => b.spendAmount - a.spendAmount);

  const best = rated.length > 0 ? rated[0] : null;
  const worst = unrated.length > 0 ? unrated[0] : rated.length > 1 ? rated[rated.length - 1] : null;
  const picks: CampaignPick[] = [];
  if (best) picks.push({ tone: "best", campaign: best });
  if (worst) picks.push({ tone: "worst", campaign: worst });
  return picks.length > 0 ? picks : null;
}

/** An amount keeps its own order inside an Arabic sentence. */
const ltr = (value: string) => `⁦${value}⁩`;

/** What the section looked like last time in this browser, so the skeleton holds the right room. */
function recall(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function remember(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage blocked: the skeleton keeps its default height.
  }
}

/**
 * «الإعلانات»: what a DELIVERED order costs in ads — the number a
 * cash-on-delivery store lives by — with the spend, the orders and the
 * delivered ones behind it, then the best and the weakest campaign.
 *
 * The figures follow the orders PLACED in the range (`GET /profit/campaigns`):
 * today's orders are rarely delivered today, and the card says so instead of
 * showing a cost. With no spend in the range the card is one slim row that
 * leads to linking an ad account, or to recording spend when one is linked.
 */
export function AdsCard({ workspaceId, range, role }: HomeSectionProps) {
  const t = useT(STRINGS);
  const common = useCommon();
  // The system roles without analytics are the ones without the financial reports too.
  const allowed = canViewAnalytics(role);
  const key = `home:ads:${workspaceId}:${range}`;

  const { data, error, refresh } = useCachedAsync<AdsData | null>(
    allowed ? key : null,
    async () => {
      if (!allowed) return null;
      const [report, connections] = await Promise.allSettled([
        profitGetCampaigns(apiClient, workspaceId, homeWindow(range)),
        adsConnectionsList(apiClient, workspaceId),
      ]);
      if (report.status === "rejected") throw report.reason;
      return {
        key,
        report: report.value,
        connected: connections.status === "fulfilled" && connections.value.some((connection) => connection.status === "connected"),
      };
    },
    [workspaceId, range, allowed]
  );

  const fresh = data && data.key === key ? data : null;
  const hasSpend = fresh ? fresh.report.totals.spendAmount > 0 : null;
  const shapeKey = `zimos.home.ads.${workspaceId}`;
  useEffect(() => {
    if (hasSpend !== null) remember(shapeKey, hasSpend ? "card" : "row");
  }, [shapeKey, hasSpend]);

  // Not for this role: a known role without the reports, or a 403 from the server.
  if (!allowed || isPermissionError(error)) return null;

  const note: Record<HomeRange, string> = { today: common.today, "7d": common.last7, "30d": common.last30 };
  const when = range === "today" ? t.whenToday : fmt(t.whenDays, { days: countOf("day", range === "7d" ? 7 : 30) });

  return (
    <HomeSection title={t.title} note={note[range]} link={hasSpend ? { to: "/ads", label: t.all } : undefined}>
      {fresh ? (
        hasSpend ? (
          <AdsFigures report={fresh.report} range={range} when={when} />
        ) : (
          <AdsNudge connected={fresh.connected} when={when} />
        )
      ) : error ? (
        <HomeSectionError message={t.error} retryLabel={t.retry} onRetry={() => void refresh()} />
      ) : (
        // Most stores have no ad spend yet: the slim row is held unless this one showed the card last time.
        <div className="@container/ads">
          <HomeSkeleton
            className={recall(shapeKey) === "card" ? "h-[25rem] @3xl/ads:h-[14.5rem]" : "h-[8.5rem] @xl/ads:h-[4.75rem]"}
          />
        </div>
      )}
    </HomeSection>
  );
}

// ------------------------------------------------------------------ parts --

function AdsFigures({ report, range, when }: { report: ProfitCampaigns; range: HomeRange; when: string }) {
  const t = useT(STRINGS);
  const { totals, currency } = report;
  const money = (minor: number) => formatMinorMoney(minor, currency);
  const picks = pickCampaigns(report);

  const figures = [
    { key: "spend", label: t.spend, value: money(totals.spendAmount), isMoney: true },
    { key: "orders", label: t.orders, value: formatCount(totals.orders), isMoney: false },
    { key: "delivered", label: t.delivered, value: formatCount(totals.delivered), isMoney: false },
  ];

  return (
    <Card data-slot="ads-card" className="gap-0 p-4">
      <div className="@container/ads">
        <div className="grid gap-4 @3xl/ads:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] @3xl/ads:items-center @3xl/ads:gap-6">
          <div className="min-w-0">
            {/* The same title line as the money cards above: a 36px chip, then the quiet label. */}
            <div className="flex min-h-9 items-center gap-2.5">
              <span
                data-slot="ads-chip"
                aria-hidden
                className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary"
              >
                <IconAds weight="duotone" className="size-5" />
              </span>
              <h3 className="min-w-0 flex-1 truncate text-[13px] leading-5 font-medium text-ink-soft" title={t.hero}>
                {t.hero}
              </h3>
            </div>

            {/* The figure of a stat card on a phone (28px); the large one (34px) where the card has the room. */}
            {totals.realCpa !== null ? (
              <>
                <p className="mt-3 text-[1.75rem] leading-9 font-semibold tracking-tight wrap-anywhere text-ink tabular-nums @3xl/ads:text-[2.125rem] @3xl/ads:leading-10">
                  <bdi dir="ltr">{money(totals.realCpa)}</bdi>
                </p>
                <p className="mt-1 text-xs leading-5 text-pretty text-ink-soft">{t.heroHint}</p>
              </>
            ) : (
              <>
                <p className="mt-3 text-[1.75rem] leading-9 font-semibold tracking-tight text-ink-soft tabular-nums @3xl/ads:text-[2.125rem] @3xl/ads:leading-10">
                  <span aria-hidden>—</span>
                  <span className="sr-only">{t.heroNoneLabel}</span>
                </p>
                <p className="mt-1 text-xs leading-5 text-pretty text-ink-soft">
                  {fmt(t.heroNone, { amount: ltr(money(totals.spendAmount)), when })}
                  {range === "today" && ` ${t.heroNoneToday}`}
                </p>
              </>
            )}

            {/* The amount gets the wider cell, so it is never cut short on a phone. */}
            <dl className="mt-3 grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)] gap-2">
              {figures.map((figure) => (
                <div key={figure.key} data-slot="ads-figure" className="min-w-0 rounded-2xl bg-paper-sunken px-3 py-2">
                  <dt className="truncate text-xs leading-4 text-ink-soft">{figure.label}</dt>
                  <dd className="mt-0.5 text-[15px] leading-6 font-semibold text-ink tabular-nums">
                    <bdi dir={figure.isMoney ? "ltr" : undefined}>{figure.value}</bdi>
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          {picks ? (
            <ul className="grid min-w-0 gap-2">
              {picks.map((pick) => (
                <CampaignRow key={pick.tone} pick={pick} currency={currency} />
              ))}
            </ul>
          ) : (
            <div data-slot="ads-row" className="flex min-w-0 items-start gap-3 rounded-2xl bg-paper-sunken px-3 py-3">
              <IconHourglass weight="fill" aria-hidden className="mt-0.5 size-5 shrink-0 text-ink-soft" />
              <p className="min-w-0 text-[13px] leading-6 text-pretty text-ink-soft">{t.noCompare}</p>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

const ROW: Record<RowTone, { icon: IconComponent; chip: string; label: string; tone: "good" | "weak" | undefined }> = {
  best: { icon: IconTrophy, chip: "bg-success-soft text-success", label: "text-success", tone: "good" },
  worst: { icon: IconTrendDown, chip: "bg-accent-soft text-accent-dark", label: "text-accent-dark", tone: "weak" },
  only: { icon: IconAnnounce, chip: "bg-primary-soft text-primary", label: "text-ink-soft", tone: undefined },
};

/** A pill row: the verdict's icon, the campaign with its platform, and what a delivered order cost in it. */
function CampaignRow({ pick, currency }: { pick: CampaignPick; currency: string }) {
  const t = useT(STRINGS);
  const { tone, campaign } = pick;
  const look = ROW[tone];
  const RowIcon = look.icon;
  const label = tone === "best" ? t.best : tone === "worst" ? t.worst : t.only;
  const name = (campaign.campaignName ?? "").trim() || t.unnamed;
  const known = Boolean(AD_PLATFORM_NAMES[campaign.platform]);

  return (
    <li data-slot="ads-row" className="flex min-h-16 min-w-0 items-center gap-3 rounded-2xl bg-paper-sunken px-3 py-2.5">
      <span
        data-slot="ads-chip"
        data-tone={look.tone}
        aria-hidden
        className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", look.chip)}
      >
        <RowIcon weight="fill" className="size-[1.125rem]" />
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn("text-xs leading-4 font-medium", look.label)}>{label}</p>
        <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-sm leading-5 font-medium text-ink">
          {known && <AdPlatformMark platform={campaign.platform} className="h-5 w-7 text-[0.5625rem]" />}
          <span dir="auto" className="min-w-0 truncate" title={name}>
            {name}
          </span>
        </p>
        {campaign.realCpa === null && (
          <p className="mt-0.5 text-xs leading-5 text-pretty text-ink-soft">
            {fmt(t.nothingDelivered, { amount: ltr(formatMinorMoney(campaign.spendAmount, currency)) })}
          </p>
        )}
      </div>
      {campaign.realCpa !== null && (
        <div className="shrink-0 text-end">
          <p className="text-[15px] leading-6 font-semibold text-ink tabular-nums">
            <bdi dir="ltr">{formatMinorMoney(campaign.realCpa, currency)}</bdi>
          </p>
          <p className="text-xs leading-4 text-ink-soft">{t.perDelivered}</p>
        </div>
      )}
    </li>
  );
}

/** No ad spend in the range: one slim row and the one step that brings the number. */
function AdsNudge({ connected, when }: { connected: boolean; when: string }) {
  const t = useT(STRINGS);
  const NudgeIcon = connected ? IconAds : IconAdAccounts;
  return (
    <Card data-slot="ads-card" className="gap-0 p-4">
      <div className="@container/ads">
        <div className="flex flex-col gap-3 @xl/ads:flex-row @xl/ads:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span
              data-slot="ads-chip"
              aria-hidden
              className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary"
            >
              <NudgeIcon weight="duotone" className="size-5" />
            </span>
            <p className="min-w-0 text-sm leading-6 text-pretty text-ink">{connected ? fmt(t.recordText, { when }) : t.connectText}</p>
          </div>
          <ViewLink
            to={connected ? "/ads" : "/ads/accounts"}
            data-slot="button"
            data-variant="outline"
            className={cn(buttonVariants({ variant: "outline" }), "min-h-11 shrink-0 rounded-full px-5 @xl/ads:min-h-9")}
          >
            {connected ? t.record : t.connect}
          </ViewLink>
        </div>
      </div>
    </Card>
  );
}
