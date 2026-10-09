import { cn } from "@store-builder/ui";
import { formatDateTime } from "@/lib/format";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { CardFrame } from "@/pages/orders/detail/CardFrame";

/**
 * How the shopper reached the store before placing this order (SPEC §13.4):
 * the first and last touch from the storefront's 30-day cookie, and what the
 * store's analytics saw of the visitor. Shown on the order page; renders
 * nothing for an order without it (a manual order, or a blocked tracker).
 *
 * The order type in the API client does not name these two fields yet, so
 * they are read defensively from the order object.
 */

interface Touch {
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
  term?: string;
  adId?: string;
  fbclid?: string;
  ttclid?: string;
  gclid?: string;
  scCid?: string;
  /** The click ids of X, Reddit, Microsoft Ads and Taboola (handoff 254). */
  twclid?: string;
  rdt_cid?: string;
  msclkid?: string;
  tblci?: string;
  ref?: string;
  referrer?: string;
  landingPage?: string;
  at?: string;
}

interface SessionStats {
  firstVisitAt?: string;
  sessions?: number;
  pageViews?: number;
  durationSeconds?: number;
}

const STRINGS = {
  en: {
    title: "Traffic source",
    description: "Where this customer came from, from the store's own tracking.",
    first: "First visit",
    last: "Before ordering",
    same: "First and last touch",
    direct: "Direct",
    source: "Source",
    medium: "Medium",
    campaign: "Campaign",
    content: "Ad",
    term: "Keyword",
    adId: "Ad ID",
    ref: "Referral",
    referrer: "Came from",
    landingPage: "Landing page",
    click: "Ad click",
    clickMeta: "Meta ad",
    clickTiktok: "TikTok ad",
    clickGoogle: "Google ad",
    clickSnap: "Snapchat ad",
    clickX: "X ad",
    clickReddit: "Reddit ad",
    clickMicrosoft: "Microsoft Ads ad",
    clickTaboola: "Taboola ad",
    at: "When",
    firstVisit: "First seen",
    sessions: "Visits",
    pageViews: "Pages viewed",
    duration: "Time on store",
    minutes: "{m} min {s} s",
    seconds: "{s} s",
  },
  ar: {
    title: "مصدر الزيارة",
    description: "من أين جاء هذا العميل، حسب تتبع المتجر نفسه.",
    first: "أول زيارة",
    last: "قبل الأوردر",
    same: "أول وآخر زيارة",
    direct: "مباشر",
    source: "المصدر",
    medium: "الوسيلة",
    campaign: "الحملة",
    content: "الإعلان",
    term: "الكلمة",
    adId: "معرّف الإعلان",
    ref: "رابط إحالة",
    referrer: "جاء من",
    landingPage: "صفحة الدخول",
    click: "نقرة إعلان",
    clickMeta: "إعلان Meta",
    clickTiktok: "إعلان TikTok",
    clickGoogle: "إعلان Google",
    clickSnap: "إعلان Snapchat",
    clickX: "إعلان X",
    clickReddit: "إعلان Reddit",
    clickMicrosoft: "إعلان Microsoft Ads",
    clickTaboola: "إعلان Taboola",
    at: "الوقت",
    firstVisit: "أول ظهور",
    sessions: "الزيارات",
    pageViews: "الصفحات",
    duration: "المدة في المتجر",
    minutes: "{m} د {s} ث",
    seconds: "{s} ث",
  },
} satisfies Messages;

type T = Record<keyof (typeof STRINGS)["en"], string>;

const isObject = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === "object" && !Array.isArray(v);

function Row({ label, value, ltr }: { label: string; value: string | undefined; ltr?: boolean }) {
  if (!value) return null;
  return (
    <div className="flex gap-2 text-sm">
      <dt className="w-28 shrink-0 text-ink-soft">{label}</dt>
      {/* Only a URL or a code may break anywhere; Arabic words wrap whole. */}
      <dd dir={ltr ? "ltr" : undefined} className={cn("min-w-0 text-start text-ink", ltr ? "break-all" : "break-words")}>
        {value}
      </dd>
    </div>
  );
}

function TouchBlock({ t, title, touch }: { t: T; title: string; touch: Touch }) {
  const click = touch.fbclid
    ? t.clickMeta
    : touch.ttclid
      ? t.clickTiktok
      : touch.gclid
        ? t.clickGoogle
        : touch.scCid
          ? t.clickSnap
          : touch.twclid
            ? t.clickX
            : touch.rdt_cid
              ? t.clickReddit
              : touch.msclkid
                ? t.clickMicrosoft
                : touch.tblci
                  ? t.clickTaboola
                  : undefined;
  return (
    <div className="min-w-0">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-soft">{title}</h3>
      <dl className="space-y-1">
        <Row label={t.source} value={touch.source ?? t.direct} />
        <Row label={t.medium} value={touch.medium} />
        <Row label={t.campaign} value={touch.campaign} />
        <Row label={t.content} value={touch.content} />
        <Row label={t.term} value={touch.term} />
        <Row label={t.adId} value={touch.adId} />
        <Row label={t.click} value={click} />
        <Row label={t.ref} value={touch.ref} />
        <Row label={t.referrer} value={touch.referrer} ltr />
        <Row label={t.landingPage} value={touch.landingPage} ltr />
        <Row label={t.at} value={touch.at ? formatDateTime(touch.at) : undefined} />
      </dl>
    </div>
  );
}

export function OrderAttributionSection({ order, frameless }: { order: object; /** Inside a folding section of the order page: no card and no title of its own. */ frameless?: boolean }) {
  const t = useT(STRINGS);
  const raw = order as { attribution?: unknown; sessionStats?: unknown };
  const attribution = isObject(raw.attribution) ? raw.attribution : null;
  const first = attribution && isObject(attribution.first) ? (attribution.first as Touch) : null;
  const last = attribution && isObject(attribution.last) ? (attribution.last as Touch) : null;
  const stats = isObject(raw.sessionStats) ? (raw.sessionStats as SessionStats) : null;
  if (!first && !last && !stats) return null;

  const same = first && last && JSON.stringify(first) === JSON.stringify(last);
  const duration =
    stats?.durationSeconds === undefined
      ? undefined
      : stats.durationSeconds >= 60
        ? fmt(t.minutes, { m: Math.floor(stats.durationSeconds / 60), s: stats.durationSeconds % 60 })
        : fmt(t.seconds, { s: stats.durationSeconds });

  return (
    <CardFrame frameless={frameless} title={t.title} description={t.description}>
      {/* One column: this card sits in the order page's narrow side column, where two would leave ~15px per value. */}
      <div className="grid gap-4">
        {same && first ? (
          <TouchBlock t={t} title={t.same} touch={first} />
        ) : (
          <>
            {first && <TouchBlock t={t} title={t.first} touch={first} />}
            {last && <TouchBlock t={t} title={t.last} touch={last} />}
          </>
        )}
        {stats && (
          <dl className="space-y-1">
            <Row label={t.firstVisit} value={stats.firstVisitAt ? formatDateTime(stats.firstVisitAt) : undefined} />
            <Row label={t.sessions} value={stats.sessions !== undefined ? String(stats.sessions) : undefined} />
            <Row label={t.pageViews} value={stats.pageViews !== undefined ? String(stats.pageViews) : undefined} />
            <Row label={t.duration} value={duration} />
          </dl>
        )}
      </div>
    </CardFrame>
  );
}
