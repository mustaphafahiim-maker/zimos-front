/** The Site traffic page and the user page's acquisition rows, English and Arabic (MSA, as the merchant dashboard). */
export const SITE_TRAFFIC_STRINGS = {
  en: {
    title: "Site traffic",
    description: "Anonymous visits to zimos.co: no IP address and no cookie is kept.",
    off: "Collection is off (SITE_ANALYTICS_ENABLED). The numbers below are what was collected before.",
    range_today: "Today",
    range_7d: "7 days",
    range_30d: "30 days",
    visits: "Visits",
    visitsHint: "Page views",
    uniqueVisitors: "Unique visitors",
    uniqueHint: "Counted per day",
    avgTime: "Avg. time on site",
    avgTimeHint: "Per session",
    topPages: "Top pages",
    topSources: "Top sources",
    sessions: "{count} sessions",
    views: "{count} views",
    direct: "Direct",
    funnel: "Funnel",
    funnelHint: "Sessions in this period",
    funnelVisit: "Visited",
    funnelCta: "Clicked sign-up or sign-in",
    funnelSignup: "Signed up",
    daily: "Visits per day",
    dailyHint: "UTC days",
    none: "No visits in this period.",
    acquisition: "Came from",
    acquisitionNone: "No tracked site visit before sign-up.",
    source: "Source",
    landingPage: "First page",
    campaign: "Campaign",
    firstVisit: "First visit",
    beforeSignup: "Time to sign-up",
  },
  ar: {
    title: "زيارات الموقع",
    description: "زيارات مجهولة الهوية لموقع zimos.co: لا يُحفظ عنوان IP ولا ملف تعريف ارتباط.",
    off: "التجميع متوقف (SITE_ANALYTICS_ENABLED). الأرقام أدناه هي ما جُمع من قبل.",
    range_today: "اليوم",
    range_7d: "7 أيام",
    range_30d: "30 يومًا",
    visits: "الزيارات",
    visitsHint: "مشاهدات الصفحات",
    uniqueVisitors: "الزوار الفريدون",
    uniqueHint: "يُحسبون لكل يوم",
    avgTime: "متوسط مدة البقاء",
    avgTimeHint: "لكل جلسة",
    topPages: "أكثر الصفحات زيارة",
    topSources: "أهم المصادر",
    sessions: "{count} جلسة",
    views: "{count} مشاهدة",
    direct: "مباشر",
    funnel: "مسار التحويل",
    funnelHint: "الجلسات في هذه الفترة",
    funnelVisit: "زار الموقع",
    funnelCta: "ضغط على التسجيل أو الدخول",
    funnelSignup: "أنشأ حسابًا",
    daily: "الزيارات اليومية",
    dailyHint: "أيام بتوقيت UTC",
    none: "لا توجد زيارات في هذه الفترة.",
    acquisition: "مصدر التسجيل",
    acquisitionNone: "لا توجد زيارة مسجلة للموقع قبل التسجيل.",
    source: "المصدر",
    landingPage: "أول صفحة",
    campaign: "الحملة",
    firstVisit: "أول زيارة",
    beforeSignup: "المدة حتى التسجيل",
  },
};

/** 75 -> "1m 15s"; Arabic uses د / ث. */
export function formatDuration(seconds: number, locale: "en" | "ar"): string {
  const s = Math.max(0, Math.round(seconds));
  const units = locale === "ar" ? { d: "ي", h: "س", m: "د", s: "ث" } : { d: "d", h: "h", m: "m", s: "s" };
  if (s < 60) return `${s}${units.s}`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}${units.m} ${s % 60}${units.s}`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}${units.h} ${m % 60}${units.m}`;
  return `${Math.floor(h / 24)}${units.d} ${h % 24}${units.h}`;
}
